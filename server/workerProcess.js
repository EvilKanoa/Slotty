const Worker = require('./worker');
const db = require('./db');
const config = require('../config');

// handle errors gracefully
const errorHandler = err => console.error('Uncaught error', err);
process.on('unhandledRejection', errorHandler);
process.on('uncaughtException', errorHandler);

// allow cleanup on shutdown
const cleanupHandler = () => {
  console.log('Shutting down Slotty Worker...');

  if (db.isOpen) {
    db.close();
  }

  process.exit(0);
};
process.on('cleanup', cleanupHandler);
process.on('exit', () => process.emit('cleanup'));
process.on('SIGINT', () => process.exit(2));

(async () => {
  console.log('Starting a Slotty worker process...');
  // connect to the database
  await db.open();

  // create and run a task worker
  const worker = new Worker(config.workerInterval * 1000, config.webadvisorApi);
  worker.start();
})()
  .then(() =>
    console.log(`
    Slotty worker process is now running!
    `)
  )
  .catch(err => {
    console.error('Encountered a fatal error during worker setup!\n', err);
    cleanupHandler();
  });
