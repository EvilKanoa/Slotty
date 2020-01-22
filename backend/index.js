const config = require('../config');
const db = require('./db');

// handle errors gracefully
const errorHandler = err => console.error('Uncaught error', err);
process.on('unhandledRejection', errorHandler);
process.on('uncaughtException', errorHandler);

// allow cleanup on shutdown
const cleanupHandler = () => {
  console.log('Shutting down Slotty...');

  if (db.isOpen) {
    db.close();
  }

  process.exit(0);
};
process.on('cleanup', cleanupHandler);
process.on('exit', () => process.emit('cleanup'));
process.on('SIGINT', () => process.exit(2));

(async () => {
  // create a new express app
  const app = require('express')();

  // register middleware and routes for express app
  app.use(require('body-parser').json({ type: '*/*' })); // assume all bodies are JSON
  require('./routes')(app);

  // connect to the database
  await db.open();

  // determine port and start the server
  const port = process.env.PORT || config.port;
  app.listen(port, () =>
    console.log(`
    Slotty is now running on port ${port}!
    `)
  );
})().catch(err => {
  console.error('Encountered a fatal error during setup', err);
});
