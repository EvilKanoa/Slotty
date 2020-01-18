const express = require('express');

/**
 * Creates an express route handler (or middleware) that stops all routing and instantly responds with the given status code.
 * The status code is automatically populated with its string representation as well.
 * @param {Number} statusCode HTTP status code to deny route with.
 * @returns {(req, res) => undefined} The route handler or middleware for express.
 */
const denyRoute = statusCode => (_req, res) => res.sendStatus(statusCode);

/**
 * Attaches notification-specific API routes to an express app instance.
 * @param {express} app Express app instance to attach notification API routes too.
 * @returns {undefined}
 */
const notificationRoutes = app => {
  // method not allowed when getting notification list
  app.get('api/notifications', denyRoute(405));

  // get notification by ID
  app.get('/api/notifications/:notificationId', (req, res) => {});

  // get notification by access key
  app.get('/api/notifications/search/:accessKey', (req, res) => {});

  // create a new notification
  app.post('/api/notifications', (req, res) => {});

  // don't allow new notifications to be created with IDs (409 conflict)
  app.post('/api/notifications/:notificationId', denyRoute(409));

  // update a notification
  app.put('/api/notifications/:notificationId', (req, res) => {});
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
};
