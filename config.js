module.exports = Object.freeze({
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
   * Defines the port that slotty will bind its web and API server to by default.
   * If the environment variable "PORT" has been set, it will override this value.
   * @readonly
   * @constant
   * @type {Number}
   */
  port: 8080,

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
    accountSid: '',
    authToken: '',
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
   *  - $termKey: The value of notification.termKey.
   *  - $contact: The value of notification.contact.
   * @readonly
   * @constant
   * @type {String}
   */
  messageTemplate: `
Hello, this is an automated message from $app in relation to the notification with the following access key: $accessKey.
An open slot has been detected for $institutionKey/$termKey/$courseKey as of $time.
We wish you luck, register fast!
(Visit $app to disable this notification using the above access key.)
`.trim(),
});
