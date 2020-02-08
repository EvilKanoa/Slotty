const Worker = require('./worker');
const db = require('./db');
const config = require('../config');

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

  // register middleware for app
  app.use(require('morgan')(config.logFormat));
  app.use(require('body-parser').json({ type: '*/*' })); // assume all bodies are JSON

  // register routes for app
  require('./docs')(app);
  require('./routes')(app); // need to register routes after any others to allow the catchall index route to function

  // connect to the database
  await db.open();

  // create and run a task worker
  const worker = new Worker(config.workerInterval * 1000, config.webadvisorApi);
  worker.start();

  // determine port and start the server
  app.listen(config.port, () =>
    console.log(`
    Slotty is now running on port ${config.port}!
    `)
  );
})()
  .then(() => console.log('Server setup complete!'))
  .catch(err => {
    console.error('Encountered a fatal error during setup!\n', err);
    cleanupHandler();
  });
