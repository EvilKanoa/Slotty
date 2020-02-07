const _ = require('lodash');
const { Pool } = require('pg');
const config = require('../config');
const utils = require('./utils');

/**
 * Notification entry that maps to the structure of notifications in the database.
 * @typedef {Object} Notification
 * @property {Number} id The internal identifier of this notification. Use to reference runs of this notification.
 * @property {Number} lastRunId The ID of the last valid run that occurred for this notification.
 * @property {String} accessKey The external unique identifier of this notification. Can be used to look up a notification.
 * @property {String} institutionKey The key used to determine which institution the course is at, should match the key used on webadvisor-api.
 * @property {String} courseKey The course code that this notification is based upon, should not include the section (e.g. CIS*1500 not CIS*1500*011).
 * @property {(String|undefined)} sectionKey If undefined, notification is sent for any open section, otherwise, matches the section or meeting with the same key (dependent on institution).
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
 * @property {(String|undefined)} error If any error occurred during this run, this field is populated with it.
 * @property {(String|undefined)} sourceData Optional string containing the data used to trigger this run.
 * @property {Date} timestamp When the run was executed.
 * @property {Boolean} notificationSent Whether a notification was sent as a result of this run or previous runs with the same slots.
 *                                      This should be set to false when the course is closed up again.
 */

/**
 * A combined data type that contains both a notification as well as the data for the last run of the notification.
 * These objects are only intended to be created for notifications that actively need actions performed.
 * @typedef {Object} ActiveNotification
 * @property {undefined} id The ID field is NOT used when a notification and run are combined, refer to `notificationId` and `runId` instead.
 * @property {Number} notificationId The interval identifier of the notification contained in this object.
 * @property {Number} runId The internal identifier of the run contained in this object, in all valid cases, this should match `lastRunId`.
 * @mixes Notification
 * @mixes NotificationRun
 */

/**
 * Utility function to convert a notification entry object from the database to a data object.
 * @param {Object} [data={}] The result of a query on the notifications table of the database.
 * @param {Notification} [overrides={}] An object of fields to use to override those within (or not within) data.
 * @returns {Notification} The Javascript object for the notification that was passed in.
 */
const toNotification = (data = {}, overrides = {}) => ({
  id: data.notification_id || undefined,
  notificationId: data.notification_id || undefined,
  lastRunId: data.last_run_id,
  accessKey: data.access_key || undefined,
  institutionKey: data.institution_key,
  courseKey: data.course_key,
  sectionKey: data.section_key || undefined,
  termKey: data.term_key,
  contact: data.contact,
  enabled: !!data.enabled,
  ...overrides,
});

/**
 * Utility function to convert a run entry object from the database to a data object.
 * @param {Object} [data={}] The result of a query on the runs table of the database.
 * @param {NotificationRun} [overrides={}] An object of fields to use to override those within (or not within) data.
 * @returns {NotificationRun} The Javascript object for the run that was passed in.
 */
const toRun = (data = {}, overrides = {}) => ({
  id: data.run_id || undefined,
  runId: data.run_id || undefined,
  notificationId: data.notification_id || undefined,
  error: data.error,
  sourceData: data.source_data,
  timestamp: data.timestamp ? new Date(data.timestamp * 1000) : undefined,
  notificationSent: !!data.notification_sent,
  ...overrides,
});

/**
 * Utility function to convert an active notification entry object from the database to a data object.
 * @param {Object} [data={}] The result of a query on the notifications table joined with the runs table.
 * @param {ActiveNotification} [overrides={}] An object of fields to use to override those within (or not within) data.
 * @returns {ActiveNotification} The Javascript object for the active notification that was passed in.
 */
const toActiveNotification = (data = {}, overrides = {}) => ({
  ..._.merge({}, toRun(data), toNotification(data)), // merge the notification and run data together
  ...overrides, // apply overrides afterwards to ensure undefined values override
  id: undefined, // forcefully remove the id value if one was given
});

/**
 * Tagged template for constructing SQL statements that will be used with sqlite3.
 * Values are passed as is, except for date objects. Any date objects will be converted to unix epoch in seconds via utils.toUnixEpoch(...).
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
 * @returns {{ text: String, values: Array<any> }} Query object that can be passed to pg.
 */
const sql = (literals, ...values) => ({
  text: literals
    .reduce(
      ({ text, param }, literal) =>
        text
          ? {
              text: `${text} $${param} ${literal}`,
              param: param + 1,
            }
          : { text: literal, param },
      { text: false, param: 1 }
    )
    .text.replace(/\s+/g, ' ')
    .trim(),
  values: values.map(val =>
    val instanceof Date ? utils.toUnixEpoch(val) : val
  ),

  // add a utility method that allows appending multiple sql strings
  append: (newLiterals, ...newValues) => {
    // create the new literals by combining the lists and joining the last entry of original with first entry of new literals
    const mergedLiterals = [
      ...literals.slice(0, -1),
      `${literals[literals.length - 1]} ${newLiterals[0]}`,
      ...newLiterals.slice(1),
    ];

    // merge both list of values together
    const mergedValues = [...values, ...newValues];

    // return the newly built query/statement
    return sql(mergedLiterals, ...mergedValues);
  },
});

/**
 * Singleton class for working with a backing database.
 * @class
 */
class DB {
  /**
   * Internal database connection pool instance for running queries.
   * @type {Pool}
   */
  pool = null;

  /**
   * Internal string used to connect to the sqlite3 database.
   * @type {String}
   */
  connectionString = '';

  /**
   * Create a new database abstraction object for a given database.
   * @param {String} connectionString The URI for the location of the database to back this instance.
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

    // use a specific client so we can create the tables with a transaction
    const client = await this.pool.connect();

    // perform all queries inside a try-catch-finally to manage the transaction
    try {
      await client.query(sql`BEGIN`);

      // create the notifications table
      await client.query(sql`
        CREATE TABLE IF NOT EXISTS notifications (
          notification_id SERIAL PRIMARY KEY,
          last_run_id INTEGER,
          access_key TEXT NOT NULL UNIQUE,
          institution_key TEXT NOT NULL,
          course_key TEXT NOT NULL,
          section_key TEXT DEFAULT NULL,
          term_key TEXT NOT NULL,
          contact TEXT NOT NULL,
          enabled BOOLEAN NOT NULL DEFAULT TRUE
        )
      `);

      // create the run history table
      await client.query(sql`
        CREATE TABLE IF NOT EXISTS runs (
          run_id SERIAL PRIMARY KEY,
          notification_id INTEGER NOT NULL,
          error TEXT,
          source_data TEXT,
          timestamp INTEGER NOT NULL,
          notification_sent BOOLEAN NOT NULL,
          FOREIGN KEY (notification_id)
            REFERENCES notifications (notification_id)
              ON DELETE CASCADE
              ON UPDATE CASCADE
        )
      `);

      // remove fk constraint if the database already was created
      await client.query(sql`
        ALTER TABLE notifications
        DROP CONSTRAINT IF EXISTS
          notifications_last_run_id_fkey
      `);

      // add the foreign key constraint to the notifications table
      await client.query(sql`
        ALTER TABLE notifications
        ADD CONSTRAINT notifications_last_run_id_fkey
          FOREIGN KEY (last_run_id)
            REFERENCES runs (run_id)
              ON DELETE SET NULL
              ON UPDATE RESTRICT
      `);

      await client.query(sql`COMMIT`);
    } catch (e) {
      // if an error was encountered, rollback changes and rethrow error
      await client.query(sql`ROLLBACK`);
      throw e;
    } finally {
      // need to release the client when we're done
      client.release();
    }
  }

  /**
   * True when a DB connection has been established.
   * @returns {Boolean} Whether the database has been opened.
   */
  get isOpen() {
    return !!this.pool;
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

    // create a new pg pool to use for connections
    this.pool = new Pool({ connectionString: this.connectionString });

    // initialize the database with the correct tables
    await this.initialize();
    console.log(`Connected to database at '${this.connectionString}'`);

    // return self for easy chaining
    return this;
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

    // close the connection pool which will close and end all connections to the db
    await this.pool.end();
    console.log(`Closed database connection from '${this.connectionString}'`);
  }

  /**
   * Creates a new notification entry in the database.
   * @param {Notification} notification The notification to insert into the database. Note that you cannot have an ID preset.
   * @returns {Promise<Notification>} The created notification entry.
   */
  async createNotification({
    institutionKey,
    courseKey,
    sectionKey,
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
      result = await this.pool.query(sql`
        SELECT notification_id FROM notifications WHERE access_key = ${accessKey}
      `);
    } while (result.rows.length > 0);

    // create the new notification
    const data = await this.pool.query(sql`
      INSERT INTO notifications(access_key, institution_key, course_key, section_key, term_key, contact, enabled)
      VALUES (${accessKey}, ${institutionKey}, ${courseKey}, ${sectionKey}, ${termKey}, ${contact}, ${!!enabled})
      RETURNING *
    `);

    // return the new notification if it was inserted correctly
    if (!data || data.rows.length <= 0) {
      throw new Error(
        'Failed to insert new notification in database with key: ',
        accessKey
      );
    } else {
      return toNotification(data.rows[0]);
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
   * @returns {Promise<Notification>} Resolves with undefined if no matching notification exists or the updated properties if successful.
   */
  async updateNotification(notification) {
    // define the mapping of notification fields to db columns
    const fieldMapping = {
      institutionKey: 'institution_key',
      courseKey: 'course_key',
      sectionKey: 'section_key',
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
      query = query.append([`${fieldMapping[key]} = `, ','], notification[key]);
    });

    // reset lastRunId since this is now essentially a different notification
    query = query.append`last_run_id = ${undefined}`;

    // add the where clause to specific the exact notification
    if (notification.id !== undefined) {
      query = query.append`WHERE notification_id = ${notification.id}`;
    } else {
      query = query.append`WHERE access_key = ${notification.accessKey}`;
    }

    // return all data from update
    query = query.append`RETURNING *`;

    // execute the query
    const result = await this.pool.query(query);

    // check if the update succeeded and if so, return the updated notification fields + the id
    if (!result || result.rows.length <= 0) {
      return undefined;
    } else {
      return toNotification(result.rows[0]);
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
    const data = await this.pool.query(query.append`LIMIT 1`);

    // if notification not found, return undefined
    if (!data || data.rows.length <= 0) {
      return undefined;
    } else {
      return toNotification(data.rows[0]);
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
      sourceData,
      timestamp = new Date(),
      notificationSent,
    } = {},
    defaultNotificationId
  ) {
    let myNotificationId =
      notificationId === undefined ? defaultNotificationId : notificationId;

    // ensure required fields were specified
    if (myNotificationId === undefined || notificationSent === undefined) {
      throw new Error(
        'Run must have a notification ID and notificationSent state specified'
      );
    }

    // TODO: Convert this crazy thing to a database transaction

    // create the new run
    const data = await this.pool.query(sql`
      INSERT INTO runs(notification_id, error, source_data, timestamp, notification_sent)
      VALUES (${myNotificationId}, ${error}, ${sourceData}, ${timestamp}, ${!!notificationSent})
      RETURNING *
    `);

    // ensure the new run was inserted correctly
    if (!data || data.rows.length <= 0) {
      throw new Error('Failed to insert new run in database');
    }

    // update the relating notification that this is now its last run
    let notificationUpdate = undefined;
    let notificationErr = undefined;
    try {
      notificationUpdate = await this.pool.query(
        sql`UPDATE notifications SET last_run_id = ${data.rows[0].run_id} WHERE notification_id = ${myNotificationId}`
      );
    } catch (err) {
      notificationErr = err;
    }

    // ensure we updated the matching notification
    if (
      notificationErr ||
      !notificationUpdate ||
      notificationUpdate.rowCount <= 0
    ) {
      // remove the run if we were unable to update the notification
      try {
        await this.pool.query(
          sql`DELETE FROM runs WHERE run_id = ${data.rows[0].run_id}`
        );
      } catch (err) {
        console.warn(err);
      }

      // throw a relevant error
      if (notificationErr) {
        throw notificationErr;
      } else {
        throw new Error(
          'Failed to update the related notification, please try again'
        );
      }
    } else {
      // if all went well, return the newly created run
      return toRun(data.rows[0]);
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
    const data = await this.pool.query(sql`
      SELECT * FROM runs WHERE run_id = ${runId} LIMIT 1
    `);

    // if run not found, return undefined
    if (!data || data.rows.length <= 0) {
      return undefined;
    } else {
      return toRun(data);
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

    // execute the query and return the transformed data
    const data = await this.pool.query(query);
    if (!data || data.rows.length <= 0) {
      return [];
    } else {
      return data.rows.map(toRun);
    }
  }

  /**
   * Queries for a list of all notifications needing actions performed determined by comparing how old their data is and a specific TTL for said data.
   * That is, this will list all notifications combined with their last run that have exceeded the TTL specified based on the last run timestamp and the specified effective TTL value.
   * Results are returned with the oldest data first.
   * @param {Number} [effectiveTtl=config.slotDataTtl] Specific the effective time-to-live to use when determining if a notification is active now.
   * @param {Number} [limit=-1] Limit the number of notifications return to allow pagination of listings. Defaults to -1 indicating no limit.
   * @returns {Promise<Array<ActiveNotification>>} List of all notifications that have passed their TTL with respect to their last run.
   */
  async listActiveNotifications(effectiveTtl = config.slotDataTtl, limit = -1) {
    // ensure the effectiveTtl value is usable
    if (typeof effectiveTtl !== 'number' || effectiveTtl < 0) {
      throw new Error(
        'The effective TTL must be a number with a value of 0 or greater'
      );
    }

    // start by building the query explicitly
    // we need to explicitly select the `notification_id` from the notification so if a run is missing, we don't get null
    let query = sql`
      SELECT *, notifications.notification_id FROM notifications
      LEFT JOIN runs
      ON notifications.last_run_id = runs.run_id
      WHERE
        (
          notifications.last_run_id IS NULL OR
          runs.timestamp < ${utils.toUnixEpoch(new Date()) - effectiveTtl}
        ) AND
        notifications.enabled = ${true}
      ORDER BY runs.timestamp ASC
    `;

    // add a limit if required
    if (limit >= 0) {
      query = query.append`LIMIT ${limit}`;
    }

    // execute the query and return the transformed data
    const data = await this.pool.query(query);
    if (!data || data.rows.length <= 0) {
      return [];
    } else {
      return data.rows.map(toActiveNotification);
    }
  }
}

// export a single instance of a DB abstraction layer
module.exports = new DB(config.isDev ? config.db.dev : config.db.prod);
