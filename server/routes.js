const express = require('express');
const statuses = require('statuses');
const path = require('path');
const MessagingResponse = require('twilio').twiml.MessagingResponse;
const db = require('./db');
const notifier = require('./notify');
const { apiUrl } = require('./utils');
const config = require('../config');

/**
 * @swagger
 *
 * tags:
 *   - name: Notifications
 *     description: Access to notifications.
 *
 *   - name: Runs
 *     description: Access to all runs for all notifications.
 *
 * definitions:
 *   Notification:
 *     description: The complete notification object for a given notification.
 *     type: object
 *     required:
 *       - institutionKey
 *       - courseKey
 *       - termKey
 *       - contact
 *     properties:
 *       id:
 *         type: integer
 *         description: The internal identifier of this notification. Use to reference runs of this notification.
 *       accessKey:
 *         type: string
 *         description: The external unique identifier of this notification. Can be used to look up a notification.
 *       lastRunId:
 *         type: integer
 *         nullable: true
 *         description: The ID of the last valid run that occurred for this notification.
 *       institutionKey:
 *         type: string
 *         description: The key used to determine which institution the course is at, should match the key used on webadvisor-api.
 *       courseKey:
 *         type: string
 *         description: The course code that this notification is based upon, should not include the section (e.g. CIS*1500 not CIS*1500*011).
 *       sectionKey:
 *         type: string
 *         nullable: true
 *         description: If undefined, notification is sent for any open section, otherwise, matches the section or meeting with the same key (dependent on institution).
 *       termKey:
 *         type: string
 *         description: The key used to determine which term the course occurs within (e.g. F19, W22, ect).
 *       contact:
 *         type: string
 *         description: The contact method used to send the notification.
 *       enabled:
 *         type: boolean
 *         default: true
 *         description: Whether this notification is currently enabled.
 *       verified:
 *         type: boolean
 *         default: false
 *         description: Whether this notification has been verified to send messages to the specified contact number.
 *     example:
 *       id: 1234
 *       lastRunId: 12345678
 *       accessKey: a1b2c3
 *       institutionKey: UOG
 *       courseKey: MATH*1200
 *       sectionKey: '0101'
 *       termKey: F22
 *       contact: '+10001112222'
 *       enabled: true
 *       verified: true
 *
 *   PartialNotification:
 *     description: A subset of the Notification model only containing the properties that a user is allowed to change.
 *     type: object
 *     properties:
 *       institutionKey:
 *         type: string
 *         description: The key used to determine which institution the course is at, should match the key used on webadvisor-api.
 *       courseKey:
 *         type: string
 *         description: The course code that this notification is based upon, should not include the section (e.g. CIS*1500 not CIS*1500*011).
 *       sectionKey:
 *         type: string
 *         nullable: true
 *         description: If undefined, notification is sent for any open section, otherwise, matches the section or meeting with the same key (dependent on institution).
 *       termKey:
 *         type: string
 *         description: The key used to determine which term the course occurs within (e.g. F19, W22, ect).
 *       contact:
 *         type: string
 *         description: The contact method used to send the notification.
 *       enabled:
 *         type: boolean
 *         default: true
 *         description: Whether this notification is currently enabled.
 *     example:
 *       institutionKey: UOG
 *       courseKey: MATH*1200
 *       sectionKey: '0101'
 *       termKey: F22
 *       contact: '+10001112222'
 *       enabled: true
 *
 *   NewNotification:
 *     description: A subset of the Notification model properties that are used during creation of new notifications.
 *     type: object
 *     required:
 *       - institutionKey
 *       - courseKey
 *       - termKey
 *       - contact
 *     properties:
 *       institutionKey:
 *         type: string
 *         description: The key used to determine which institution the course is at, should match the key used on webadvisor-api.
 *       courseKey:
 *         type: string
 *         description: The course code that this notification is based upon, should not include the section (e.g. CIS*1500 not CIS*1500*011).
 *       sectionKey:
 *         type: string
 *         nullable: true
 *         description: If undefined, notification is sent for any open section, otherwise, matches the section or meeting with the same key (dependent on institution).
 *       termKey:
 *         type: string
 *         description: The key used to determine which term the course occurs within (e.g. F19, W22, ect).
 *       contact:
 *         type: string
 *         description: The contact method used to send the notification.
 *       enabled:
 *         type: boolean
 *         default: true
 *         description: Whether this notification is currently enabled.
 *     example:
 *       institutionKey: UOG
 *       courseKey: MATH*1200
 *       termKey: F22
 *       contact: '+10001112222'
 *
 *   Run:
 *     type: object
 *     required:
 *       - notificationId
 *       - timestamp
 *       - notificationSent
 *     properties:
 *       id:
 *         type: integer
 *         description: The internal identifier of this run.
 *       notificationId:
 *         type: integer
 *         description: The internal identifier of the notification that triggered this run.
 *       error:
 *         type: string
 *         nullable: true
 *         description: If any error occurred during this run, this field is populated with it.
 *       sourceData:
 *         type: string
 *         nullable: true
 *         description: Optional string containing the data used to trigger this run.
 *       timestamp:
 *         type: string
 *         format: date-time
 *         description: When the run was executed.
 *       notificationSent:
 *         type: boolean
 *         description: >
 *           Whether a notification was sent as a result of this run or previous runs with the same slots.
 *           This should be set to false when the course is closed up again.
 *     example:
 *       id: 123456
 *       notificationId: 1234
 *       error: null
 *       sourceData: '{ data: { course: { sections: [] } } }'
 *       timestamp: '2020-02-07T18:29:41Z'
 *       notificationSent: false
 *
 *   Error:
 *     type: object
 *     required:
 *       - status
 *       - message
 *     properties:
 *       status:
 *         type: integer
 *         minimum: 100
 *         maximum: 599
 *       message:
 *         type: string
 *
 * responses:
 *   NotFoundError:
 *     description: The specified resource was not found.
 *     schema:
 *       $ref: '#/definitions/Error'
 *     examples:
 *       application/json:
 *         status: 404
 *         message: Not Found
 *
 *   BadRequestAccessKeyError:
 *     description: The server was unable to determine what access key was specified.
 *     schema:
 *       $ref: '#/definitions/Error'
 *     examples:
 *       application/json:
 *         status: 400
 *         message: Access key must be a valid, non-empty string
 *
 * parameters:
 *   accessKey:
 *     name: accessKey
 *     in: path
 *     description: The access key used to specify a notification.
 *     type: string
 *     required: true
 */

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
    res.json(err.json);
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
const denyRoute = statusCode => (_req, _res, next) => next(new HTTPError(statusCode));

/**
 * Defines a generic express route handler for use with `withErrors`.
 * @callback expressHandler
 * @param {Object} req The express request object.
 * @param {Object} res The express response object.
 * @param {Function} next Callback function if extra functionality is needed.
 * @returns {Promise<any>}
 */
/**
 * Higher order function to wrap async express route handlers so that thrown errors get redirected to
 * express's next(..) function.
 * @param {expressHandler} handler The route handler that may reject.
 * @returns {expressHandler} A new function which will catch any errors that occur within handler and pass them to next(...).
 */
const withErrors = handler => (req, res, next) => handler(req, res, next).catch(next);

/**
 * @swagger
 *
 * /notifications/{accessKey}:
 *   parameters:
 *     - $ref: '#/parameters/accessKey'
 *
 *   get:
 *     summary: Look up a notification using an access key.
 *     description: Attempts to retrieve all notification data for some notification based upon the access key. Note that the access key is case sensitive.
 *     tags:
 *       - Notifications
 *     responses:
 *       200:
 *         description: A notification with the given access key was found and returned successfully.
 *         schema:
 *           $ref: '#/definitions/Notification'
 *       400:
 *         $ref: '#/responses/BadRequestAccessKeyError'
 *       404:
 *         $ref: '#/responses/NotFoundError'
 *
 *   put:
 *     summary: Update a notification using an access key to identify it.
 *     description: Performs a partial update of a specific notification. All parameters set in the request will be set on the notification if possible. You must provide an access key. You cannot update a notification's ID or access key. If a change is made to a notification's contact, the notification must be verified again. A verification message will be sent automatically in this case.
 *     tags:
 *       - Notifications
 *     parameters:
 *       - in: body
 *         name: notification
 *         description: The set of properties to update for the notification specified by the access key.
 *         required: true
 *         schema:
 *           $ref: '#/definitions/PartialNotification'
 *     responses:
 *       200:
 *         description: A notification with the given access key was found and updated with the new properties successfully.
 *         schema:
 *           $ref: '#/definitions/Notification'
 *       400:
 *         $ref: '#/responses/BadRequestAccessKeyError'
 *       404:
 *         $ref: '#/responses/NotFoundError'
 *
 *   delete:
 *     summary: Disable a given notification using an access key.
 *     description: Sets the enabled property of a given notification to false. Performs the same action as a PUT with a body specifying only an access key and enabled set to false.
 *     tags:
 *       - Notifications
 *     responses:
 *       200:
 *         description: A notification with the given access key was found and set to disabled successfully.
 *         schema:
 *           $ref: '#/definitions/Notification'
 *       400:
 *         $ref: '#/responses/BadRequestAccessKeyError'
 *       404:
 *         $ref: '#/responses/NotFoundError'
 *
 * /notifications:
 *   post:
 *     summary: Create a new notification from the information given.
 *     description: Creates a new notification based upon the body of the request. A new access key will be automatically generated for the notification. Before a notification can be used, it must first be verified. A verification message will be sent automatically when a new notification is created. If enabled was not false, then the notification will be active immediately after verification.
 *     tags:
 *       - Notifications
 *     parameters:
 *       - in: body
 *         name: notification
 *         description: >
 *           The new notification to create. Note that the following fields normally found on notifications are disallowed during creation: id, accessKey, and lastRunId.
 *         required: true
 *         schema:
 *           $ref: '#/definitions/NewNotification'
 *     responses:
 *       201:
 *         description: A new notification was created with the provided properties successfully.
 *         schema:
 *           $ref: '#/definitions/Notification'
 *       400:
 *         description: The parameters of the request are not valid and thus no action may be performed.
 *         schema:
 *           $ref: '#/definitions/Error'
 *         examples:
 *           application/json:
 *             status: 400
 *             message: >
 *               The notification object supplied has extra fields that are disallowed: id, accessKey
 */
/**
 * Attaches notification-specific API routes to an express app instance.
 * @param {express} app Express app instance to attach notification API routes too.
 * @returns {undefined}
 */
const notificationRoutes = app => {
  // method not allowed when getting notification list
  app.get(apiUrl('notifications'), denyRoute(405));

  // get notification by access key
  app.get(
    apiUrl('notifications/:accessKey'),
    withErrors(async (req, res) => {
      const { accessKey } = req.params;

      // check that a valid access key was given
      if (!accessKey || typeof accessKey !== 'string' || accessKey.length <= 0) {
        throw new HTTPError(400, 'Access key must be a valid, non-empty string');
      }

      // try to find the notification
      const notification = await db.getNotification({ accessKey });

      // check if we found a notification or not and send the correct response
      if (!notification || notification.accessKey !== accessKey) {
        throw new HTTPError(404);
      } else {
        return res.status(200).json(notification);
      }
    })
  );

  // create a new notification
  app.post(
    apiUrl('notifications'),
    withErrors(async (req, res) => {
      const data = req.body || {};
      const requiredFields = ['institutionKey', 'courseKey', 'termKey', 'contact'];
      const optionalFields = ['sectionKey', 'enabled'];

      // determine missing and extra fields
      const missingFields = requiredFields.filter(key => !data.hasOwnProperty(key));
      const extraFields = Object.keys(data).filter(
        key => !requiredFields.includes(key) && !optionalFields.includes(key)
      );

      // if missing and/or extra fields exist, respond with a suitable error
      if (missingFields.length > 0) {
        throw new HTTPError(
          400,
          `The notification object supplied is missing the following (required) fields: ${missingFields.join(
            ', '
          )}`
        );
      } else if (extraFields.length > 0) {
        throw new HTTPError(
          400,
          `The notification object supplied has extra fields that are disallowed: ${extraFields.join(
            ', '
          )}`
        );
      }

      // if no issues exist, create the new notification
      const notification = await db.createNotification(data);

      // also need to send a verification message for the notification
      try {
        await notifier.sendVerification(notification, 'created');
      } catch (err) {
        // if we cannot send a verification message, we should not enable the notification
        await db.updateNotification({ id: notification.id, enabled: false });
        // throw the error so it gets logged correctly
        throw err;
      }

      // return the notification if it was created successfully
      if (notification) {
        return res.status(201).json(notification);
      } else {
        // if no notification was returned AND no error thrown, simply 500
        throw new HTTPError();
      }
    })
  );

  // don't allow new notifications to be created with IDs (409 conflict)
  app.post(apiUrl('notifications/:notificationId'), denyRoute(409));

  // disable a notification
  app.delete(
    apiUrl('notifications/:accessKey'),
    withErrors(async (req, res) => {
      const { accessKey } = req.params;

      // check that a valid access key was given
      if (!accessKey || typeof accessKey !== 'string' || accessKey.length <= 0) {
        throw new HTTPError(400, 'Access key must be a valid, non-empty string');
      }

      // try to find and disable the notification
      const notification = await db.updateNotification({
        accessKey,
        enabled: false,
      });

      // check if we failed to find a notification and throw an error if so, otherwise return the updated notification
      if (!notification || notification.accessKey !== accessKey) {
        throw new HTTPError(404);
      } else {
        return res.status(200).json(notification);
      }
    })
  );

  // update a notification
  app.put(
    apiUrl('notifications/:accessKey'),
    withErrors(async (req, res) => {
      const data = req.body || {};
      const { accessKey } = req.params;

      // check that a valid access key was given
      if (!accessKey || typeof accessKey !== 'string' || accessKey.length <= 0) {
        throw new HTTPError(400, 'Access key must be a valid, non-empty string');
      }

      // ensure only allowed fields have been specified
      const allowedFields = [
        'institutionKey',
        'courseKey',
        'termKey',
        'sectionKey',
        'contact',
        'enabled',
      ];
      const extraFields = Object.keys(data).filter(key => !allowedFields.includes(key));
      if (extraFields.length > 0) {
        throw new HTTPError(
          400,
          `The notification changes object supplied has the following extra fields which are disallowed: ${extraFields.join(
            ', '
          )}`
        );
      }

      // attempt to update the notification with the specified ID
      const notification = await db.updateNotification({ accessKey, ...data });

      // also need to verify the notification if it had a change to contact

      // also need to send a verification message for the notification
      if (data.contact) {
        try {
          await notifier.sendVerification(notification, 'modified');
        } catch (err) {
          // if we cannot send a verification message, we should not enable the notification
          await db.updateNotification({ id: notification.id, enabled: false });
          // throw the error so it gets logged correctly
          throw err;
        }
      }

      // return the notification if it was updated successfully
      if (notification) {
        return res.status(200).json(notification);
      } else {
        // if no notification was returned then assume no notification was found
        throw new HTTPError(404);
      }
    })
  );
};

/**
 * @swagger
 *
 * /runs/{runId}:
 *   get:
 *     summary: Look up an individual run of a notification by its ID.
 *     description: Attempts to retrieve the run with the ID specified. You can retrieve a run for any notification as long as you supply a valid run ID.
 *     tags:
 *       - Runs
 *     parameters:
 *       - in: path
 *         name: runId
 *         description: The run ID used to specify a run.
 *         type: integer
 *         required: true
 *     responses:
 *       200:
 *         description: A run with the given ID was found and returned successfully.
 *         schema:
 *           $ref: '#/definitions/Run'
 *       400:
 *         description: The server was unable to determine what run ID was specified in the request.
 *         schema:
 *           $ref: '#/definitions/Error'
 *         examples:
 *           application/json:
 *             status: 400
 *             message: The run ID must be a valid positive integer
 *       404:
 *         $ref: '#/responses/NotFoundError'
 *
 * /runs/list/{accessKey}/{limit}:
 *   get:
 *     summary: Get a list of runs given a notification access key.
 *     description: Retrieves a list of all runs belonging to the notification that was specified by access key. If a limit option is given, the list will be limited to a maximum of the specified limit. If no runs found, either when the notification has had no runs, or the notification access key does not belong to a real notification, an empty list is returned.
 *     tags:
 *       - Runs
 *     parameters:
 *       - in: path
 *         name: accessKey
 *         description: The identifier to use when finding a notification.
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: limit
 *         description: Enforce a limit on the maximum number of runs returned. Can be unset or set to -1 to indicate no limit should be used.
 *         required: false
 *         default: -1
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Array of runs found belonging to the notification specified. If no runs or no notification found, this will be an empty array.
 *         schema:
 *           type: array
 *           items:
 *             $ref: '#/definitions/Run'
 *       400:
 *         $ref: '#/responses/BadRequestAccessKeyError'
 */
/**
 * Attaches run-specific API routes to an express app instance.
 * @param {express} app Express app instance to attach run API routes too.
 * @returns {undefined}
 */
const runRoutes = app => {
  // get a single run by id
  app.get(
    apiUrl('runs/:runId'),
    withErrors(async (req, res) => {
      const runId = parseInt(req.params.runId, 10);

      // check that a valid run ID was given
      if (!runId || isNaN(runId) || runId <= 0) {
        throw new HTTPError(400, 'The run ID must be a valid positive integer');
      }

      // try to find the run
      const run = await db.getRun(runId);

      // check if we found a run or not and send the correct response
      if (!run) {
        throw new HTTPError(404);
      } else {
        return res.status(200).json(run);
      }
    })
  );

  // get a list of runs by notification id or access key
  app.get(
    apiUrl('runs/list/:accessKey/:limit?'),
    withErrors(async (req, res) => {
      const { accessKey } = req.params;
      const limit = parseInt(req.params.limit || '-1', 10);

      // check that a valid access key was given
      if (!accessKey || typeof accessKey !== 'string' || accessKey.length <= 0) {
        throw new HTTPError(400, 'Access key must be a valid, non-empty string');
      } else if (isNaN(limit)) {
        throw new HTTPError(400, 'The limit value must be an integer value');
      }

      // try to perform the run listing using our parameters
      const runs = await db.getRuns({ accessKey }, limit);

      // since not found requests simply return an empty list, we can return runs in all cases
      res.status(200).json(runs);
    })
  );
};

/**
 * Attaches the API routes to an express app instance
 * @param {express} app Express app instance to attach API routes too.
 * @returns {undefined}
 */
const apiRoutes = app => {
  // redirect root of API routes to docs
  app.get(apiUrl(), (_req, res) => res.redirect(apiUrl('docs')));

  // register API routes for each resource
  notificationRoutes(app);
  runRoutes(app);
};

/**
 * Attaches routes to handle webhooks (and incoming requests) to an express app instance.
 * @param {express} app Express app instance to attach webhook routes too.
 * @returns {undefined}
 */
const webhookRoutes = app => {
  // attach verification sms handler
  app.post(
    '/sms',
    withErrors(async (req, res) => {
      const { AccountSid: accountSid, From: from, Body: accessKey } = req.body;

      // output logging information
      console.log('Received SMS at webhook', req.body);

      // ensure we have all needed fields and the correct accountSid is present
      if (!accountSid || !from || !accessKey) {
        throw new HTTPError(
          400,
          'Request body must contain AccountSid, From, and Body fields at a minimum'
        );
      } else if (accountSid.trim() !== config.twilio.accountSid.trim()) {
        throw new HTTPError(401, 'Invalid account SID, access denied');
      }

      // find the notification that is being verified
      const notification = await db.getNotification({ accessKey });

      // start construction a response SMS
      const twiml = new MessagingResponse();

      // ensure user is able to verify this notification
      if (
        notification &&
        notification.contact === from &&
        accessKey === notification.accessKey
      ) {
        // verify the notification in the db
        await db.updateNotification({ accessKey, verified: true });

        // attach the correct response
        twiml.message(
          notifier.formatMessage(notifier.MESSAGE_TYPE.VERIFIED, {
            $accessKey: accessKey,
          })
        );
      } else {
        // attach the correct response
        twiml.message(
          notifier.formatMessage(notifier.MESSAGE_TYPE.NOT_VERIFIED, {
            $accessKey: accessKey,
          })
        );
      }

      // send a reply based on the result of the verification
      res.writeHead(200, { 'Content-Type': 'text/xml' });
      res.write(twiml.toString());
      res.end();
    })
  );
};

module.exports = app => {
  // serve up all files in the 'build' directory statically
  // this provides a simple HTTP server
  app.use(express.static(path.resolve(__dirname, '../build')));

  // attach API routes
  apiRoutes(app);

  // add webhook rooutes
  webhookRoutes(app);

  // catch all unknown routes and serve our index bundle to allow client-side routing
  // this must come after the above registrations so it does not override the static or API routes
  const index = path.resolve(__dirname, '../build/index.html');
  app.get('*', (_req, res) => res.sendFile(index));

  // attach our error handler to catch all errors and, in particular, HTTPErrors
  app.use(errorHandler);
};
