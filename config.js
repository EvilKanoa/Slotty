const _ = require('lodash');
const utils = require('./backend/utils');

// load environment variables
require('dotenv').config();

/**
 * Define the default options and types of the configuration.
 * Note: If you want to change these values, a better option is to create a .env file.
 *       All environment variables that match config options will get used instead.
 * @readonly
 * @type {Object}
 */
const config = {
  /**
   * Defines the name of the app that is used for any dynamic operations.
   * In particular, this is the name used when sending notifications.
   * @readonly
   * @constant
   * @type {String}
   */
  appName: "Slotty",

  /**
   * Provides a wrapper around the app environment.
   * @readonly
   * @constant
   * @type {Boolean}
   */
  isDev: process.env.NODE_ENV === 'development',

  /**
   * Defines the format to tell morgan to use when logging requests.
   * @see https://github.com/expressjs/morgan#readme
   * @readonly
   * @constant
   * @type {String}
   */
  logFormat: 'common',

  /**
   * Defines the port that slotty will bind its web and API server to by default.
   * If the environment variable "PORT" has been set, it will override this value.
   * @readonly
   * @constant
   * @type {Number}
   */
  port: 8080,

  /**
   * Defines the interval, in seconds, between each slot check that is performed.
   * Each slot check will make a large number of HTTP requests (GraphQL queries) to webadvisor-api.
   * Note: Do not set this value too low or you may get rate limited, on the other hand, if you set it to high, you may miss open slots.
   * @readonly
   * @constant
   * @type {Number}
   */
  workerInterval: 15 /* seconds */,

  /**
   * Defines the time, in seconds, that results from slot checks will be considered valid for.
   * If this value is less than the workerInterval, all notifications will be checked on every worker run.
   * Otherwise, if this value is larger than worker interval, notifications will end up being checked in chunks.
   * @readonly
   * @constant
   * @type {Number}
   */
  slotDataTtl: 0 /* seconds */,

  /**
   * Defines what file should back the SQLite database depending on the mode of the app.
   * It is highly recommended to use a file-based location for production so data persists
   * accross app reboots (and crashes). When developing, it may be faster to simply use the
   * in-memory option.
   * @example
   * // use a value of ':memory:' to use an in memory database
   * { dev: ':memory:' }
   * @example
   * // alternatively, point it to a local file
   * { prod: './slotty.db' }
   * @readonly
   * @constant
   * @type {{ dev: String, prod: String }}
   */
  db: {
    dev: ':memory:',
    prod: './slotty.db',
  },

  /**
   * Defines the account credentials used to connect to Twilio (SMS provider).
   * These must be set to valid values if you wish to send SMS notifications.
   * @readonly
   * @constant
   * @type {{ accountSid: String, authToken: String, fromNumber: String }}
   */
  twilio: {
    accountSid: 'ACfake',
    authToken: 'fake',
    fromNumber: '',
  },

  /**
   * Defines the message that will be sent as a notification.
   * A simple replace will be ran over this string to inject a select few variables using a '$' prefix to denote variables.
   * @example
   * Variables:
   *  - $app: Extracts the name of the app as a string (e.g. "Slotty").
   *  - $time: A datetime string generated at the time of building the message.
   *  - $accessKey: The value of notification.accessKey.
   *  - $availableSlots: The current number of available slots.
   *  - $totalSlots: The current total number of slots.
   *  - $institutionKey: The value of notification.institutionKey.
   *  - $courseKey: The value of notification.courseKey.
   *  - $sectionKey: The value of notification.sectionKey.
   *  - $termKey: The value of notification.termKey.
   *  - $contact: The value of notification.contact.
   * @readonly
   * @constant
   * @type {String}
   */
  messageTemplate: `
Hello, this is an automated message from $app in relation to the notification with the following access key: "$accessKey".
Some open slots ($availableSlots/$totalSlots) have been detected for $courseKey/$sectionKey ($institutionKey - $termKey) as of $time.
We wish you luck, register fast!
(Visit $app to disable this notification using the above access key.)
`.trim(),
};

/**
 * Defines all custom user set values that override the config defaults.
 * These are passed in as environment variables. Use SCREAMING_SNAKE_CASE.
 * To access config values that are subitems, simply use an underscore.
 * @readonly
 * @type {Object}
 */
const overrideConfig = utils
  .getPrimitiveKeys(config)
  .map(configKey => ({ configKey, envKey: utils.snakeCase(configKey.split('.'), true) }))
  .filter(({ envKey }) => process.env.hasOwnProperty(envKey))
  .reduce((obj, { configKey, envKey }) => _.set(obj, configKey, process.env[envKey]), {});

// merge the custom overrides into the base config and export that
module.exports = Object.freeze(_.merge({}, config, overrideConfig));
