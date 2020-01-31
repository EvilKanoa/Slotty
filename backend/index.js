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

  // register middleware and routes for express app
  app.use(require('morgan')(config.logFormat));
  app.use(require('body-parser').json({ type: '*/*' })); // assume all bodies are JSON
  require('./routes')(app);

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

  // create a buncha notifications
  const notifications = await Promise.all(
    [
      { sectionKey: '0101' },
      {},
      { sectionKey: '0105' },
      { courseKey: 'MATH*1200', sectionKey: '03' },
      { courseKey: 'MATH*1200' },
      { courseKey: 'MA100', institutionKey: 'WLU', sectionKey: '1856' },
      { courseKey: 'MA100', institutionKey: 'WLU', sectionKey: '1890' },
      { courseKey: 'MA100', institutionKey: 'WLU', sectionKey: '1826' },
      { courseKey: 'MA100', institutionKey: 'WLU' },
      { courseKey: 'MA100', institutionKey: 'WLU', sectionKey: '1856' },
    ]
      .map(fields => ({
        institutionKey: 'UOG',
        courseKey: 'CIS*1500',
        termKey: 'W20',
        contact: 'default@default.com',
        ...fields,
      }))
      .map(notification => db.createNotification(notification))
  );

  console.log(`Created ${notifications.length} notifications...`);
  const runs = await Promise.all(
    notifications
      .map(({ id }) => {
        const numRuns = Math.floor(Math.random() * 3) * 3 - 2;
        const runs = [];
        console.log(
          `Creating ${numRuns} runs for notification with ID = ${id}...`
        );
        for (let i = 0; i < numRuns; i++) {
          runs.push(
            db.createRun({
              notificationId: id,
              notificationSent: Math.random() >= 0.75,
            })
          );
        }
        return runs;
      })
      .flat()
  );
  console.log(`Created a total of ${runs.length} runs.`);
})().catch(err => {
  console.error('Encountered a fatal error during setup!\n', err);
  cleanupHandler();
});
