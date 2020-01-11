const config = require('../config');
// enable verbose db logging when in dev mode
const sqlite3 = config.isDev
  ? require('sqlite3').verbose()
  : require('sqlite3');

/**
 * Utility function to wrap db.run(...) calls in a promise.
 * @param {sqlite3.Database} db The database to perform the run operation upon.
 * @param {String} sql The SQL query to be ran.
 * @param {Array<any>|undefined} params The params to insert into the SQL query.
 * @returns {Promise<Error|undefined>} Resolves if run succeeds or rejects with db error.
 */
const runAsync = (db, sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, err => {
    if (err) {
      reject(err);
    } else {
      resolve();
    }
  })
});

/**
 * Utility function to wrap db.serialize(...) calls in a promise. Use with runAsync(...).
 * @param {sqlite3.Database} db The database to perform the serialization upon.
 * @param {async function} cmds Function that runs async commands upon the database.
 */
const serializeAsync = (db, cmds) => new Promise((resolve, reject) => {
  db.serialize(() => {
    cmds().then(() => resolve()).catch(reject);
  });
});

/**
 * Utility function to wrap db.parallelize(...) calls in a promise. Use with runAsync(...).
 * @param {sqlite3.Database} db The database to perform the parallelization upon.
 * @param {async function} cmds Function that runs async commands upon the database.
 */
const paralellizeAsync = (db, cmds) => new Promise((resolve, reject) => {
  db.paralellize(() => {
    cmds().then(() => resolve()).catch(reject);
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
      return Promise.reject('Must be connected to a database before initialization');
    }

    // create required tables in database
    return serializeAsync(this.db, async () => {
      // create the users table
      await runAsync(this.db, `
        CREATE TABLE IF NOT EXISTS users (
          user_id INTEGER PRIMARY KEY,
          access_key TEXT NOT NULL UNIQUE
        )
      `);

      // create the notications table
      await runAsync(this.db, `
        CREATE TABLE IF NOT EXISTS notifications (
          notification_id INTEGER PRIMARY KEY,
          user_id INTEGER NOT NULL,
          institution_key TEXT NOT NULL,
          course_key TEXT NOT NULL,
          enabled BOOLEAN NOT NULL CHECK (enabled IN (0,1)),
          FOREIGN KEY (user_id)
            REFERENCES users (user_id)
              ON DELETE CASCADE
              ON UPDATE NO ACTION
        )
      `);

      // create the run history table
      await runAsync(this.db, `
        CREATE TABLE IF NOT EXISTS runs (
          run_id INTEGER PRIMARY KEY,
          notification_id INTEGER NOT NULL,
          error TEXT,
          timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (notification_id)
            REFERENCES notifications (notification_id)
              ON DELETE CASCADE
              ON UPDATE NO ACTION
        )
      `);
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
            this.initialize().then(() => {
              console.log(`Connected to database at '${this.connectionString}'`);
              resolve(this);
            }).catch(reject);
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
}

// export a single instance of a DB abstraction layer
module.exports = new DB(config.isDev ? config.db.dev : config.db.prod);
