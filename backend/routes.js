const express = require('express');
const statuses = require('statuses');
const db = require('./db');
const config = require('../config');

/**
 * Represents an error which can be sent as a HTTP error.
 * Will be picked up by error handling middleware when thrown.
 * @class
 */
class HTTPError extends Error {
  /**
   * Creates a new HTTPError with a given status and optionally an override message.
   * @param {Number} [status=500] The status code of the HTTP error that occurred.
   * @param {String} [message=undefined] An optional message to override the default HTTP code based message with.
   */
  constructor(status = 500, message) {
    // determine the correct message to use
    const errorMessage = message || statuses[status] || `${status}`;

    super(`${status} ${errorMessage}`);
    this.status = status;
    this.errorMessage = errorMessage;
  }

  /**
   * Converts an HTTPError to a serializable object to be sent as a JSON error message
   * @returns {{ status: Number, message: String }} Serializable object for HTTP replies.
   */
  get json() {
    return {
      status: this.status,
      message: this.errorMessage,
    };
  }
}

/**
 * Express error handler middleware to catch all errors emitted during route resolution.
 * In particular, catches instances of HTTPErrors and handles them gracefully.
 * Any other errors get interpreted as 500 Internal Server Errors and include a stacktrace in dev mode.
 * @param {Error} err The thrown error, can be any error but special attention is given to instances of HTTPErrors.
 * @param {Object} _req Unused in handler from express.
 * @param {Object} res Express response object to send error through.
 * @param {Function} next Express callback to send errors through to the default handler if needed.
 * @returns {undefined}
 */
const errorHandler = (err, _req, res, next) => {
  // if the headers were already sent, pass the error to expresses' default handler
  if (res.headersSent) {
    return next(err);
  }

  // check if the error is expected
  if (err instanceof HTTPError) {
    res.status(err.status);
    res.send(err.json);
  } else {
    // log error to console to track unexpected issues
    console.error(err);

    // when unexpected error occurs, send error 500 and include stacktrace if in dev mode
    res.status(500);
    res.json(new HTTPError(500, config.isDev ? err.stack : undefined).json);
  }
};

/**
 * Creates an express route handler (or middleware) that stops all routing and instantly responds with the given status code.
 * The status code is automatically populated with its string representation as well.
 * @param {Number} statusCode HTTP status code to deny route with.
 * @returns {(req, res, next) => undefined} The route handler or middleware for express.
 */
const denyRoute = statusCode => (_req, _res, next) =>
  next(new HTTPError(statusCode));

/**
 * Attaches notification-specific API routes to an express app instance.
 * @param {express} app Express app instance to attach notification API routes too.
 * @returns {undefined}
 */
const notificationRoutes = app => {
  // method not allowed when getting notification list
  app.get('/api/notifications', denyRoute(405));

  // get notification by access key
  app.get('/api/notifications/:accessKey', async (req, res, next) => {
    const { accessKey } = req.params;

    // check that a valid notification ID was given
    if (!accessKey || typeof accessKey !== 'string' || accessKey.length <= 0) {
      return next(
        new HTTPError(400, 'Access key must be a valid, non-empty string')
      );
    }

    // try to find the notification
    const notification = await db.getNotification({ accessKey });

    // check if we found a notification or not and send the correct response
    if (!notification || notification.accessKey !== accessKey) {
      return next(new HTTPError(404));
    } else {
      return res.status(200).json(notification);
    }
  });

  // create a new notification
  app.post('/api/notifications', async (req, res, next) => {
    const data = req.body || {};
    const requiredFields = [
      'institutionKey',
      'courseKey',
      'termKey',
      'contact',
    ];
    const optionalFields = ['enabled'];

    // determine missing and extra fields
    const missingFields = requiredFields.filter(
      key => !data.hasOwnProperty(key)
    );
    const extraFields = Object.keys(data).filter(
      key => !requiredFields.includes(key) && !optionalFields.includes(key)
    );

    // if missing and/or extra fields exist, respond with a suitable error
    if (missingFields.length > 0) {
      return next(
        new HTTPError(
          400,
          `The notification object supplied is missing the following (required) fields: ${missingFields.join(
            ', '
          )}`
        )
      );
    } else if (extraFields.length > 0) {
      return next(
        new HTTPError(
          400,
          `The notification object supplied has extra fields that are disallowed: ${extraFields.join(
            ', '
          )}`
        )
      );
    }

    // if no issues exist, create the new notification
    const notification = await db.createNotification(data);

    // return the notification if it was created successfully
    if (notification) {
      return res.status(201).json(notification);
    } else {
      // if no notification was returned AND no error thrown, simply 500
      return next(new HTTPError());
    }
  });

  // don't allow new notifications to be created with IDs (409 conflict)
  app.post('/api/notifications/:notificationId', denyRoute(409));

  // update a notification
  app.put('/api/notifications/:notificationId', async (req, res) => {});
};

/**
 * Attaches the API routes to an express app instance
 * @param {express} app Express app instance to attach API routes too.
 * @returns {undefined}
 */
const apiRoutes = app => {
  notificationRoutes(app);
};

module.exports = app => {
  // serve up all files in the 'frontend' directory statically
  // this provides a simple HTTP server
  app.use(express.static('frontend'));

  // api route: testing
  app.get('/test', (_req, res) => {
    res.json({ test: 'oh yeah bby' });
  });

  // attach API routes
  apiRoutes(app);

  // attach our error handler to catch all errors and, in particular, HTTPErrors
  app.use(errorHandler);
};
