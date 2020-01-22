const config = require('../config');
const utils = require('./utils');
// enable verbose db logging when in dev mode
const sqlite3 = config.isDev
  ? require('sqlite3').verbose()
  : require('sqlite3');

/**
 * Notification entry that maps to the structure of notifications in the database.
 * @typedef {Object} Notification
 * @property {Number} id The internal identifier of this notification. Use to reference runs of this notification.
 * @property {String} accessKey The external unique identifier of this notification. Can be used to look up a notification.
 * @property {String} institutionKey The key used to determine which institution the course is at, should match the key used on webadvisor-api.
 * @property {String} courseKey The course code that this notification is based upon, should include the section (e.g. CIS*1500*011).
 * @property {String} termKey The key used to determine which term the course occurs within (e.g. F19, W22, ect).
 * @property {String} contact The contact method used to send the notification.
 * @property {Boolean} enabled Whether this notification is currently enabled.
 */

/**
 * An individual run of some notification. Includes whether it should be ran again and other important info.
 * Each notification may have none, one, or many runs.
 * @typedef {Object} NotificationRun
 * @property {Number} id The internal identifier of this run.
 * @property {Number} notificationId The internal identifier of the notification that triggered this run.
 * @property {String} error If any error occurred during this run, this field is populated with it.
 * @property {Date} timestamp When the run was executed.
 * @property {Boolean} courseOpen Whether the course in question had open slots at the time of running.
 * @property {Boolean} notificationSent Whether a notification was sent as a result of this run or previous runs with the same slots.
 *                                      This should be set to false when the course is closed up again.
 */

/**
 * Tagged template for constructing SQL statements that will be used with sqlite3.
 * @example
 * // insert a value into a table
 * db.run(...sql`INSERT INTO table VALUES (${'My first value'}, ${4})`);
 *
 * @example
 * // dynamically append to a query
 * let query = sql`SELECT * FROM items WHERE color = ${color}`;
 * if (limit) {
 *   query = query.append`LIMIT ${limit}`;
 * }
 * db.get(...query);
 *
 * @param {Array<String>} literals The literals of the SQL statement.
 * @param {...any} values The values that must be inserted into the string.
 * @returns {[String, Array<any>]} Arguments that can be spread into the sqlite3 db functions.
 */
const sql = (literals, ...values) => {
  // transform into data that is usable by sqlite3
  const stmt = [
    literals
      .join('?')
      .replace(/\s+/g, ' ')
      .trim(),
    values,
  ];

  // add a utility method that allows appending multiple sql strings
  stmt.append = (literals, ...values) => {
    // prefix the first literal with our original query
    const mergedLiterals = [`${stmt[0]} ${literals[0]}`, ...literals.slice(1)];
    // merge both list of values together
    const mergedValues = [...stmt[1], ...values];

    // return the newly built query/statement
    return sql(mergedLiterals, ...mergedValues);
  };

  return stmt;
};

/**
 * Takes a created sqlite3 Database and binds async versions of db functions.
 * Bound functions include run, get, and all.
 * @example
 * // bind some database with async db functions
 * db = bindAsync(db);
 *
 * @example
 * // get a row
 * const row = await db.getAsync(sql`SELECT * FROM table WHERE column = ${value}`);
 * // or even
 * const { id, column, ...row } = await db.getAsync(...);
 *
 * @example
 * // create a new entry
 * const { lastID, changes } = await db.runAsync(sql`INSERT INTO table VALUES (...)`);
 *
 * @param {sqlite3.Database} db The database to bind async alternatives onto.
 * @returns {sqlite3.Database} The passed database with the async methods bound onto it.
 */
const bindAsync = db => {
  // the following functions can all be found in the same fashion
  ['get', 'all'].forEach(fn => {
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

  // need to add async run separately since it returns data through `this`
  db.runAsync = (...args) => {
    // allow tagged sql strings to be passed without spread
    const dbArgs = args.length === 1 ? args[0] : args;

    // wrap the original call within a new promise
    return new Promise((resolve, reject) =>
      // need to use old function syntax so `this` keyword is available
      db.run(...dbArgs, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this);
        }
      })
    );
  };

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
   * Internal database instance from sqlite3
   * @type {sqlite3.Database}
   */
  db = null;

  /**
   * Internal string used to connect to the sqlite3 database.
   * @type {String}
   */
  connectionString = '';

  /**
   * Create a new database abstraction object for a given database.
   * @param {String} connectionString The filename or indicator for the location of the database to back this instance.
   */
  constructor(connectionString) {
    this.connectionString = connectionString;
  }

  /**
   * Creates the schema if needed. Do not call this directly, instead, use db.open() which will call initialize().
   * @returns {Promise<undefined>} Resolves if initializing succeeds, rejects with any db errors.
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
        contact TEXT NOT NULL,
        enabled BOOLEAN NOT NULL CHECK (enabled IN (0,1)) DEFAULT 1
      )
    `);

    // create the run history table
    await this.db.runAsync(sql`
      CREATE TABLE IF NOT EXISTS runs (
        run_id INTEGER PRIMARY KEY AUTOINCREMENT,
        notification_id INTEGER NOT NULL,
        error TEXT,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        course_open BOOLEAN NOT NULL CHECK (course_open IN (0, 1)),
        notification_sent BOOLEAN NOT NULL CHECK (notification_sent IN (0, 1)),
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
   * @returns {Promise<DB>} Promise that rejects with DB error or resolves with DB instance.
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
   * @param {Notification} notification The notification to insert into the database. Note that you cannot have an ID preset.
   * @returns {Promise<Notification>} The created notification entry.
   */
  async createNotification({
    institutionKey,
    courseKey,
    termKey,
    contact,
    enabled = true,
  } = {}) {
    if (!institutionKey || !courseKey || !termKey || !contact) {
      throw new Error(
        'Notification must have keys for institution, course, and term as well as a contact method'
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
    const data = await this.db.runAsync(sql`
      INSERT INTO notifications(access_key, institution_key, course_key, term_key, contact, enabled)
      VALUES (${accessKey}, ${institutionKey}, ${courseKey}, ${termKey}, ${contact}, ${!!enabled})
    `);

    // return the new notification if it was inserted correctly
    if (!data || data.changes <= 0) {
      throw new Error(
        'Failed to insert new notification in database with key: ',
        accessKey
      );
    } else {
      return {
        id: data.lastID,
        accessKey,
        institutionKey,
        courseKey,
        termKey,
        contact,
        enabled: !!enabled,
      };
    }
  }

  /**
   * Updates the notification in the database to match the data contained within the passed notification object.
   * Any unset fields will not be changed.
   *
   * Note 1: There must exist some notification in the database with a matching ID or, if no ID present, a matching access key.
   *
   * Note 2: You cannot change / update the access key of a notification.
   * @param {Notification} notification The new data for the notification with notification.id used as a query.
   * @returns {Promise<Notification>} Resolves with undefined if no matching notification exists.
   */
  async updateNotification(notification) {
    // define the mapping of notification fields to db columns
    const fieldMapping = {
      institutionKey: 'institution_key',
      courseKey: 'course_key',
      termKey: 'term_key',
      contact: 'contact',
      enabled: 'enabled',
    };

    // ensure that we have a method to specify the correct notification
    if (notification.id === undefined && !notification.accessKey) {
      throw new Error('Notification ID or access key must be specified');
    }

    // determine which fields are gonna need to be updated
    const fieldsToSet = Object.keys(fieldMapping).filter(key =>
      notification.hasOwnProperty(key)
    );

    // ensure that we have work to do
    if (fieldsToSet.length === 0) {
      // if we do not set any fields, we can return early
      return notification;
    }

    // start building the update query
    let query = sql`UPDATE notifications SET`;

    // dynamically build the update statement
    fieldsToSet.forEach((key, idx, arr) => {
      // append this set clause with or without a comma
      if (idx === arr.length - 1) {
        query = query.append(
          [`${fieldMapping[key]} = `, ''],
          notification[key]
        );
      } else {
        query = query.append(
          [`${fieldMapping[key]} = `, ','],
          notification[key]
        );
      }
    });

    // add the where clause to specific the exact notification
    if (notification.id !== undefined) {
      query = query.append`WHERE notification_id = ${notification.id}`;
    } else {
      query = query.append`WHERE access_key = ${notification.accessKey}`;
    }

    // execute the query
    const result = await this.db.runAsync(query);

    // check if the update succeeded and if so, return the updated notification fields + the id
    if (!result || result.changes < 1) {
      return undefined;
    } else {
      return {
        ...notification,
        notificationId: result.lastID,
      };
    }
  }

  /**
   * Gets the notification matching the ID or access key specified.
   * @param {Object} idOrAccessKey Object containing the query data.
   * @param {Number} idOrAccessKey.id Set this value to search by ID (default if both values filled).
   * @param {String} idOrAccessKey.accessKey Set this value to search by access key.
   * @returns {Promise<Notification|undefined>} Resolves with undefined if no notification found.
   */
  async getNotification(idOrAccessKey) {
    if (
      !idOrAccessKey ||
      (idOrAccessKey.id === undefined && !idOrAccessKey.accessKey)
    ) {
      throw new Error(
        'Either the notification ID or access key must be specified'
      );
    }

    // use the correct query to find a matching notification
    let query = sql`SELECT * FROM notifications`;
    if (idOrAccessKey.id !== undefined) {
      query = query.append`WHERE notification_id = ${idOrAccessKey.id}`;
    } else {
      query = query.append`WHERE access_key = ${idOrAccessKey.accessKey}`;
    }
    const data = await this.db.getAsync(query.append`LIMIT 1`);

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
        contact: data.contact,
        enabled: !!data.enabled,
      };
    }
  }

  /**
   * Creates a new run entry in the database for a given notification.
   * @param {NotificationRun} run The run to insert into the database. Note that you cannot have an ID preset.
   * @param {Number} [defaultNotificationId=run.notificationId] If the notification ID is not present in the run object, it must be specified here.
   * @returns {Promise<NotificationRun>} The created notification entry.
   */
  async createRun(
    {
      notificationId,
      error,
      timestamp = new Date(),
      courseOpen,
      notificationSent,
    } = {},
    defaultNotificationId
  ) {
    let myNotificationId =
      notificationId === undefined ? defaultNotificationId : notificationId;

    // ensure required fields were specified
    if (
      myNotificationId === undefined ||
      courseOpen === undefined ||
      notificationSent === undefined
    ) {
      throw new Error(
        'Run must have a notification ID, courseOpen state, and notificationSent state specified'
      );
    }

    // create the new run
    const data = await this.db.runAsync(sql`
      INSERT INTO runs(notification_id, error, timestamp, course_open, notification_sent)
      VALUES (${myNotificationId}, ${error}, ${timestamp}, ${!!courseOpen}, ${!!notificationSent})
    `);

    // return the new run if it was inserted correctly
    if (!data || data.changes <= 0) {
      throw new Error('Failed to insert new run in database');
    } else {
      return {
        id: data.lastID,
        notificationId,
        error,
        timestamp,
        courseOpen: !!courseOpen,
        notificationSent: !!notificationSent,
      };
    }
  }

  /**
   * Gets the run entry with a matching ID from the database.
   * @param {Number} runId The ID of the run entry to get.
   * @returns {Promise<NotificationRun|undefined} Resolves with undefined if no run found.
   */
  async getRun(runId) {
    // ensure we have an ID to get
    if (runId === undefined) {
      throw new Error('Run ID must be specified');
    }

    // try to find a matching run in the database
    const data = await this.db.getAsync(sql`
      SELECT * FROM runs WHERE run_id = ${runId} LIMIT 1
    `);

    // if run not found, return undefined
    if (!data) {
      return undefined;
    } else {
      return {
        id: data.run_id,
        notificationId: data.notification_id,
        error: data.error,
        timestamp: data.timestamp && new Date(data.timestamp),
        courseOpen: !!data.course_open,
        notificationSent: !!data.notification_sent,
      };
    }
  }

  /**
   * Gets runs for a given notification that may be specified by notification ID or access key.
   * You may limit the number of runs returned by passing a value above -1 to limit.
   * When limit = -1, all matching runs will be returned (could cause an OOM error).
   * Runs will always be filtered by descending timestamp (most recent runs come first).
   * @param {Object} idOrAccessKey Object containing the notification query data.
   * @param {Number} idOrAccessKey.id Set this value to search by ID (default if both values filled).
   * @param {String} idOrAccessKey.accessKey Set this value to search by access key.
   * @param {Number} [limit=1] Limit the number of runs returned. Set to -1 for no limit. Defaults to a limit of 1.
   * @returns {Promise<Array<NotificationRun>>} Array of runs found. Sorted with most recent run first.
   */
  async getRuns(idOrAccessKey, limit = 1) {
    if (
      !idOrAccessKey ||
      (idOrAccessKey.id === undefined && !idOrAccessKey.accessKey)
    ) {
      throw new Error(
        'Either the notification ID or access key must be specified'
      );
    }

    // start building the query
    let query = sql`SELECT * FROM runs`;

    // either directly query with notification ID or perform a subquery to find the correct notification ID.
    if (idOrAccessKey.id !== undefined) {
      query = query.append`WHERE notification_id = ${idOrAccessKey.id}`;
    } else {
      query = query.append`
        WHERE notification_id = (
          SELECT notification_id FROM notifications WHERE access_key = ${idOrAccessKey.accessKey} LIMIT 1
        )
      `;
    }

    // apply the correct sorting
    query = query.append`ORDER BY timestamp DESC`;

    // apply the limit if required
    if (limit >= 0) {
      query = query.append`LIMIT ${limit}`;
    }

    // execute and return the query
    return (await this.db.allAsync(query)) || [];
  }
}

// export a single instance of a DB abstraction layer
module.exports = new DB(config.isDev ? config.db.dev : config.db.prod);
