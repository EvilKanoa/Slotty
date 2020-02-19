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
    UNKNOWN: 'unknown',
  };

  /**
   * Defines the different base messages that may be used when sending a formatted message.
   * @readonly
   * @enum
   * @type {Object}
   */
  MESSAGE_TYPE = {
    NOTIFICATION: config.notificationMessageTemplate,
    VERIFICATION: config.verificationMessageTemplate,
    VERIFIED: config.verifiedMessageTemplate,
    NOT_VERIFIED: config.notVerifiedMessageTemplate,
  };

  /**
   * Defines the string that is used when undefined variables are used while formatting a message.
   * @readonly
   * @constant
   * @type {String}
   */
  FALLBACK_VARIABLE_VALUE = '-';

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
   * Given a base message type from Notifier.MESSAGE_TYPE, and an object of variables, a new message will be created and formatted.
   * Note: This does not send a message, only applies the formatting required.
   * @param {String} messageType One of the values from Notifier.MESSAGE_TYPE that defines what type of message should be formatted.
   * @param {Object} variables Object containing all variables and what they should be replaced with, each key should be prefixed with a '$'.
   *                           Some additional variables will also be added if not present such as $app and $time.
   * @returns {String} A formatted message string.
   */
  formatMessage(messageType = '', variables = {}) {
    // define variables that can be used in the message and their values based on passed variables.
    const allVariables = {
      $app: config.appName,
      $time: new Date().toUTCString(),
      ...variables,
    };

    // format and return the message string
    return Object.keys(allVariables).reduce(
      (msg, key) =>
        msg.replace(
          new RegExp(`\\${key}`, 'ig'),
          allVariables[key] || this.FALLBACK_VARIABLE_VALUE
        ), // need to escape the '$' of the variable
      messageType
    );
  }

  /**
   * Smart notification sending. Handles contact type determination and formatting as well as message formatting.
   * Call with a notification and associated event data to trigger a message to be sent if possible.
   * @throws
   * @param {Object} notification A notification object from the database.
   * @param {{ totalSlots: Number, availableSlots: Number }} event Object containing all fields related to the event in question.
   * @returns {Promise<Object>} Resolves if notification sent successfully with API result data or rejects with an error.
   */
  async sendNotification(notification, event = {}) {
    // ensure that params are sufficient
    if (!notification || !notification.contact) {
      throw new Error('Notification object must be present and contain a contact value');
    }

    // determine the correct contact method if available
    const contactInfo = this.getContactInfo(notification.contact);
    if (contactInfo.type === this.CONTACT_TYPE.UNKNOWN) {
      throw new Error(
        'Unknown contact type for notification, unable to send notification'
      );
    }

    // build the notification message
    const message = this.formatMessage(this.MESSAGE_TYPE.NOTIFICATION, {
      $availableSlots: event.availableSlots,
      $totalSlots: event.totalSlots,
      $accessKey: notification.accessKey,
      $institutionKey: notification.institutionKey,
      $courseKey: notification.courseKey,
      $sectionKey: notification.sectionKey,
      $termKey: notification.termKey,
      $contact: notification.contact,
    });

    // send the notification
    return this.sendMessage(contactInfo.type, contactInfo.destination, message);
  }

  /**
   * Smart verification message sending. Handles contact type determination and formatting as well as message formatting.
   * Call with a notification and associated action type to trigger a message to be sent if possible.
   * @throws
   * @param {Object} notification A notification object from the database.
   * @param {("created"|"modified")} action Type of action that triggered a verification message to be sent.
   * @returns {Promise<Object>} Resolves if verification sent successfully with API result data or rejects with an error.
   */
  async sendVerification(notification, action) {
    // ensure that params are sufficient
    if (!notification || !notification.contact) {
      throw new Error('Notification object must be present and contain a contact value');
    } else if (notification.verified) {
      // if the notification is already verified, no action needs to be performed
      return;
    }

    // determine the correct contact method if available
    const contactInfo = this.getContactInfo(notification.contact);
    if (contactInfo.type === this.CONTACT_TYPE.UNKNOWN) {
      throw new Error(
        'Unknown contact type for verification, unable to send verification'
      );
    }

    // build the notification message
    const message = this.formatMessage(this.MESSAGE_TYPE.VERIFICATION, {
      $action: action,
      $accessKey: notification.accessKey,
      $contact: notification.contact,
    });

    // send the notification
    return this.sendMessage(contactInfo.type, contactInfo.destination, message);
  }

  /**
   * Smart verified message sending. Handles contact type determination and formatting as well as message formatting.
   * @throws
   * @param {String} contact The contact to send a verified message to.
   * @param {String} accessKey The access key of the notification which was verified.
   * @returns {Promise<Object>} Resolves if verified message sent successfully with API result data or rejects with an error.
   */
  async sendVerified(contact, accessKey) {
    // ensure that params are sufficient
    if (!contact) {
      throw new Error('A contact value must be present');
    }

    // determine the correct contact method if available
    const contactInfo = this.getContactInfo(contact);
    if (contactInfo.type === this.CONTACT_TYPE.UNKNOWN) {
      throw new Error(
        'Unknown contact type for verified message, unable to send message'
      );
    }

    // build the verified message
    const message = this.formatMessage(this.MESSAGE_TYPE.VERIFIED, {
      $accessKey: accessKey,
      $contact: contact,
    });

    // send the verified message
    return this.sendMessage(contactInfo.type, contactInfo.destination, message);
  }

  /**
   * Sends a message using the indicated type of service.
   * @throws {Error} If any service error occurs, it will be passed back.
   * @param {CONTACT_TYPE} type A value from CONTACT_TYPE indicating the sending service.
   * @param {String} destination The destination of the message.
   * @param {(String|{ subject: String, body: String })} message The message to send. Either pass a single string to use as the body with a blank subject or an object containing both values.
   * @returns {Promise<Object>} Resolves with the API response if message was sent successfully.
   */
  async sendMessage(type, destination, message) {
    // ensure we have valid input
    if (!type || !destination || !message) {
      console.log({ type, destination, message });
      throw new Error('Type, destination, and message must all have valid values');
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

  /**
   * Utility function to help determine what contact type to use for a given destination.
   * Additionally, will prepare the destination string for use. This may require some clean up depending on the contact type.
   * @param {String} destination The destination that will have its contact type computed.
   * @returns {{ type: CONTACT_TYPE, destination: String }} The contact type that destination most likely uses or CONTACT_TYPE.UNKNOWN if unable to determine as type and the cleaned destination string.
   */
  getContactInfo(destination) {
    if (!destination || typeof destination !== 'string' || destination.length <= 0) {
      return { type: this.CONTACT_TYPE.UNKNOWN, destination: '' };
    }

    // use loose checks (will return true with invalid phone numbers) to handle user input better
    if (destination.replace(/\(|\)|\s|-/g, '').match(/^\+[1-9]\d{1,14}$/)) {
      // phone number check
      return {
        type: this.CONTACT_TYPE.TEXT,
        destination: destination.replace(/\(|\)|\s|-/g, ''),
      };
    } else if (destination.match(/^\S+@\S+$/g)) {
      // email check
      return { type: this.CONTACT_TYPE.EMAIL, destination: destination.trim() };
    } else {
      // no matching type found :/
      return { type: this.CONTACT_TYPE.UNKNOWN, destination: '' };
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
