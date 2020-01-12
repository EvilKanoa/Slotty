const config = require('../config');
const utils = require('./utils');
// enable verbose db logging when in dev mode
const sqlite3 = config.isDev
  ? require('sqlite3').verbose()
  : require('sqlite3');

/**
 * Utility function to wrap db.xxx(...) calls in a promise.
 * @param {sqlite3.Database} db The database to perform the run operation upon.
 * @param {String} funcName The name of the db function to run in async (e.g. 'run', 'get').
 * @param {String} sql The SQL query to be ran.
 * @param {Array<any>|undefined} params The params to insert into the SQL query.
 * @returns {Promise<Error|undefined>} Resolves with data if func succeeds or rejects with db error.
 */
const dbAsync = (db, funcName, sql, params = []) =>
  new Promise((resolve, reject) => {
    if (!db[funcName] || typeof db[funcName] !== 'function') {
      return Promise.reject('Unknown db funcName supplied');
    }

    db[funcName](sql, params, (err, res) => {
      if (err) {
        reject(err);
      } else {
        resolve(res);
      }
    });
  });

/**
 * Utility function to wrap db.run(...) calls in a promise.
 * @param {sqlite3.Database} db The database to perform the run operation upon.
 * @param {String} sql The SQL query to be ran.
 * @param {Array<any>|undefined} params The params to insert into the SQL query.
 * @returns {Promise<Error|undefined>} Resolves if run succeeds or rejects with db error.
 */
const runAsync = (db, sql, params = []) => dbAsync(db, 'run', sql, params);

/**
 * Utility function to wrap db.serialize(...) calls in a promise. Use with runAsync(...).
 * @param {sqlite3.Database} db The database to perform the serialization upon.
 * @param {async function} cmds Function that runs async commands upon the database.
 */
const serializeAsync = (db, cmds) =>
  new Promise((resolve, reject) => {
    db.serialize(() => {
      cmds()
        .then(() => resolve())
        .catch(reject);
    });
  });

/**
 * Utility function to wrap db.parallelize(...) calls in a promise. Use with runAsync(...).
 * @param {sqlite3.Database} db The database to perform the parallelization upon.
 * @param {async function} cmds Function that runs async commands upon the database.
 */
const paralellizeAsync = (db, cmds) =>
  new Promise((resolve, reject) => {
    db.paralellize(() => {
      cmds()
        .then(() => resolve())
        .catch(reject);
    });
  });

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

    // create required tables in database
    return serializeAsync(this.db, async () => {
      // create the notications table
      await runAsync(
        this.db,
        `
        CREATE TABLE IF NOT EXISTS notifications (
          notification_id INTEGER PRIMARY KEY AUTOINCREMENT,
          access_key TEXT NOT NULL UNIQUE,
          institution_key TEXT NOT NULL,
          course_key TEXT NOT NULL,
          term_key TEXT NOT NULL,
          enabled BOOLEAN NOT NULL CHECK (enabled IN (0,1)),
          interval INTEGER NOT NULL DEFAULT 15,
          repeat INTEGER NOT NULL DEFAULT 3
        )
        `
      );

      // create the run history table
      await runAsync(
        this.db,
        `
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
        `
      );
    });
  }

  /**
   * True when a DB connection has been established.
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
      return Promise.resolve(this);
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
   * @returns Promise that rejects with DB error or resolves on close.
   */
  async close() {
    // if DB not opened, resolve and return early
    if (!this.isOpen) {
      return Promise.resolve();
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
   * @returns {Object} The created notification entry.
   */
  async createNotification(notification) {
    if (
      !notification ||
      !notification.institutionKey ||
      !notification.courseKey ||
      !notification.termKey
    ) {
      throw new Error(
        'Notification must have keys for institution, course, and term'
      );
    }

    // find a valid access key
    let accessKey = '';
    let result = undefined;
    do {
      accessKey = utils.generateAccessKey();
      result = await dbAsync(
        this.db,
        'get',
        'SELECT notification_id id FROM notifications WHERE access_key = ?',
        [accessKey]
      );
    } while (result !== undefined);

    // create the new notification
    await runAsync(
      this.db,
      `
      INSERT INTO notifications(access_key, institution_key, course_key, term_key, enabled, interval, repeat)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        accessKey,
        notification.institutionKey,
        notification.courseKey,
        notification.termKey,
        notification.enabled === undefined || notification.enabled,
        notification.interval || 15,
        notification.repeat || 3,
      ]
    );

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
      data = await dbAsync(
        this.db,
        'get',
        'SELECT * FROM notifications WHERE notification_id = ?',
        [idOrAccessKey.id]
      );
    } else {
      data = await dbAsync(
        this.db,
        'get',
        'SELECT * FROM notifications WHERE access_key = ?',
        [idOrAccessKey.accessKey]
      );
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
