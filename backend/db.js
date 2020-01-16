const config = require('../config');
const utils = require('./utils');
// enable verbose db logging when in dev mode
const sqlite3 = config.isDev
  ? require('sqlite3').verbose()
  : require('sqlite3');

/**
 * Tagged template for constructing SQL statements that will be used with sqlite3.
 * @example
 * // insert a value into a table
 * db.run(...sql`INSERT INTO table VALUES (${'My first value'}, ${4})`);
 * @param {Array<String>} literals The literals of the SQL statement.
 * @param {...any} values The values that must be inserted into the string.
 * @returns {[String, Array<any>]} Arguments that can be spread into the sqlite3 db functions.
 */
const sql = (literals, ...values) => [literals.join('?'), values];

/**
 * Takes a created sqlite3 Database and binds async versions of db functions.
 * Bound functions include run and get.
 * @param {sqlite3.Database} db The database to bind async alternatives onto.
 * @returns {sqlite3.Database} The passed database with the async methods bound onto it.
 */
const bindAsync = db => {
  // the following functions can all be found in the same fashion
  ['run', 'get', 'all'].forEach(fn => {
    db[`${fn}Async`] = (...args) => {
      // allow tagged sql strings to be passed without spread
      const dbArgs = args.length === 1 ? args[0] : args;

      // wrap the original call within a new promise
      return new Promise((resolve, reject) =>
        db[fn](...dbArgs, (err, res) => {
          if (err) {
            reject(err);
          } else {
            resolve(res);
          }
        })
      );
    };
  });

  // add indicator that the db object has bound functions added
  db.asyncBound = true;

  // return the bound db (since this method mutates the object, this may not be used)
  return db;
};

/**
 * Singleton class for working with a backing database.
 * @class
 */
class DB {
  /**
   * Create a new database abstraction object for a given database.
   * @param {String} connectionString The filename or indicator for the location of the database to back this instance.
   */
  constructor(connectionString) {
    this.connectionString = connectionString;
    this.db = null;
  }

  /**
   * Creates the schema if needed. Do not call this directly, instead, use db.open() which will call initialize().
   */
  async initialize() {
    // should fail if the db hasn't been opened
    if (!this.isOpen) {
      return Promise.reject(
        'Must be connected to a database before initialization'
      );
    }

    // create the notifications table
    await this.db.runAsync(sql`
      CREATE TABLE IF NOT EXISTS notifications (
        notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
        access_key TEXT NOT NULL UNIQUE,
        institution_key TEXT NOT NULL,
        course_key TEXT NOT NULL,
        term_key TEXT NOT NULL,
        enabled BOOLEAN NOT NULL CHECK (enabled IN (0,1)) DEFAULT 1,
        interval INTEGER NOT NULL DEFAULT 15,
        repeat INTEGER NOT NULL DEFAULT 3
      )
    `);

    // create the run history table
    await this.db.runAsync(sql`
      CREATE TABLE IF NOT EXISTS runs (
        run_id INTEGER PRIMARY KEY AUTOINCREMENT,
        notification_id INTEGER NOT NULL,
        error TEXT,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (notification_id)
          REFERENCES notifications (notification_id)
            ON DELETE CASCADE
            ON UPDATE NO ACTION
      )
    `);
  }

  /**
   * True when a DB connection has been established.
   * @returns {Boolean} Whether the database has been opened.
   */
  get isOpen() {
    return this.db && this.db.open;
  }

  /**
   * Attempts to open the database associated with this DB object.
   * @returns Promise that rejects with DB error or resolves with DB instance.
   */
  async open() {
    // if DB already opened, resolve and return early
    if (this.isOpen) {
      return this;
    }

    // create a new promise to wrap the sqlite3 open functions
    return new Promise((resolve, reject) => {
      // attempt to open the database specified by connectionString
      this.db = new sqlite3.Database(
        this.connectionString,
        sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
        err => {
          if (err) {
            console.error(
              `Failed to open a connection to the database at '${this.connectionString}'`,
              err
            );
            reject(err);
          } else {
            // add async functions to the db object
            bindAsync(this.db);

            // initialize our database
            this.initialize()
              .then(() => {
                console.log(
                  `Connected to database at '${this.connectionString}'`
                );
                resolve(this);
              })
              .catch(reject);
          }
        }
      );
    });
  }

  /**
   * Attempts to close the database associated with this DB object.
   * @returns {Promise<undefined>} Promise that rejects with DB error or resolves on close.
   */
  async close() {
    // if DB not opened, resolve and return early
    if (!this.isOpen) {
      return;
    }

    // create a new promise to wrap the sqlite3 close functions
    return new Promise((resolve, reject) => {
      this.db.close(err => {
        if (err) {
          console.error(
            `Failed to close database connection from '${this.connectionString}'`,
            err
          );
          reject(err);
        } else {
          this.db = null;
          console.log(
            `Closed database connection from '${this.connectionString}'`
          );
          resolve();
        }
      });
    });
  }

  /**
   * Creates a new notification entry in the database.
   * @param {Object} notification New data for the notification.
   * @param {String} notification.institutionKey
   * @param {String} notification.courseKey
   * @param {String} notification.termKey
   * @param {Boolean} notification.enabled
   * @param {Number} notification.interval
   * @param {Number} notification.repeat
   * @returns {Promise<Object>} The created notification entry.
   */
  async createNotification({
    institutionKey,
    courseKey,
    termKey,
    enabled = true,
    interval = 15,
    repeat = 3,
  } = {}) {
    if (!institutionKey || !courseKey || !termKey) {
      throw new Error(
        'Notification must have keys for institution, course, and term'
      );
    }

    // find a valid access key
    let accessKey = '';
    let result = undefined;
    do {
      accessKey = utils.generateAccessKey();
      result = await this.db.getAsync(sql`
        SELECT notification_id id FROM notifications WHERE access_key = ${accessKey}
      `);
    } while (result !== undefined);

    // create the new notification
    await this.db.runAsync(sql`
      INSERT INTO notifications(access_key, institution_key, course_key, term_key, enabled, interval, repeat)
      VALUES (${accessKey}, ${institutionKey}, ${courseKey}, ${termKey}, ${enabled}, ${interval}, ${repeat})
    `);

    // load notification from db for return
    const data = await this.getNotification({ accessKey });
    if (!data) {
      throw new Error(
        'Failed to insert new notification in database with key: ',
        accessKey
      );
    } else {
      return data;
    }
  }

  /**
   * Gets the notification matching the ID or access key specified.
   * @param {Object} idOrAccessKey Object containing the query data.
   * @param {String} idOrAccessKey.id Set this value to search by ID (default if both values filled).
   * @param {String} idOrAccessKey.accessKey Set this value to search by access key.
   * @returns {Promise<Object|undefined>} Resolves with undefined if no notification found.
   */
  async getNotification(idOrAccessKey) {
    if (!idOrAccessKey || (!idOrAccessKey.id && !idOrAccessKey.accessKey)) {
      throw new Error(
        'Either the notification ID or access key must be specified'
      );
    }

    // use the correct query to find a matching notification
    let data;
    if (idOrAccessKey.id) {
      data = await this.db.getAsync(sql`
        SELECT * FROM notifications WHERE notification_id = ${idOrAccessKey.id}
      `);
    } else {
      data = await this.db.getAsync(sql`
        SELECT * FROM notifications WHERE access_key = ${idOrAccessKey.accessKey}
      `);
    }

    // if notification not found, return undefined
    if (!data) {
      return undefined;
    } else {
      return {
        id: data.notification_id,
        accessKey: data.access_key,
        institutionKey: data.institution_key,
        courseKey: data.course_key,
        termKey: data.term_key,
        enabled: data.enabled,
        interval: data.interval,
        repeat: data.repeat,
      };
    }
  }
}

// export a single instance of a DB abstraction layer
module.exports = new DB(config.isDev ? config.db.dev : config.db.prod);
