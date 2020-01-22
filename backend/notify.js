const config = require('../config');

/**
 * Singleton class that allows messages to be sent through a variety of means.
 * @class
 */
class Notifier {
  /**
   * Defines different types of contact methods that may be used to send a notification.
   * @readonly
   * @enum
   * @type {Object} Where each key is an enum value.
   */
  CONTACT_TYPE = {
    EMAIL: 'email',
    TEXT: 'text',
  };

  /**
   * Contains a Twilio client object configured based upon user supplied options.
   * @type {Object}
   */
  twilio = null;

  /**
   * Creates a new notifier instance with the given options.
   * @param {Object} twilio Object containing Twilio specific options.
   * @param {String} twilio.accountSid The account SID value for Twilio.
   * @param {String} twilio.authToken The auth token value for Twilio.
   * @param {Object} twilio.clientOptions Any client options to pass to the Twilio client constructor.
   */
  constructor({ accountSid, authToken, clientOptions }) {
    this.twilio = require('twilio')(accountSid, authToken, clientOptions);
  }

  /**
   * Sends a message using the indicated type of service.
   * @throws {Error} If any service error occurs, it will be passed back.
   * @param {CONTACT_TYPE} type A value from CONTACT_TYPE indicating the sending service.
   * @param {String} destination The destination of the message.
   * @param {(String|{ subject: String, body: String})} message The message to send. Either pass a single string to use as the body with a blank subject or an object containing both values.
   * @returns {Promise<Object>} Resolves with the API response if message was sent successfully.
   */
  async sendMessage(type, destination, message) {
    // ensure we have valid input
    if (!type || !destination || !message) {
      console.log({ type, destination, message });
      throw new Error(
        'Type, destination, and message must all have valid values'
      );
    }

    // extract the information required for the message
    let subject = '';
    let body = '';
    if (typeof message === 'string') {
      body = message;
    } else if (typeof message === 'object') {
      subject = message.subject || '';
      body = message.body || message.subject || '';
    } else {
      throw new Error('Message is not of the correct type, see documentation');
    }

    // actually send the message depending on the type
    switch (type) {
      case this.CONTACT_TYPE.TEXT:
        // use the Twilio client to create a new SMS
        return this.twilio.messages
          .create({ to: destination, from: config.twilio.fromNumber, body })
          .then(msg => {
            // before returning this promise, check if a silent error occurred and throw it if needed
            if (msg && (msg.error_code || msg.error_message)) {
              throw new Error(
                `Error found in Twilio response (${msg.error_code || ''}): ${
                  msg.error_message
                }`
              );
            } else {
              // pass data back if no error
              return msg;
            }
          });
      case this.CONTACT_TYPE.EMAIL:
        throw new Error('Email type is not currently implemented');
      default:
        throw new Error('Unknown CONTACT_TYPE, unable to send message');
    }
  }
}

/**
 * Instance of Notifier. Only this single instance should be constructed.
 * @type {Notifier}
 */
const notifier = new Notifier(config.twilio);

// export the singleton instance created above
module.exports = notifier;
