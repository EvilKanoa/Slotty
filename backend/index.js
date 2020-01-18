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
  app.use(require('body-parser').json());
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

  // dev testing code below
  console.log('Creating a new notification and a bunch of runs...');
  const { id: notificationId } = await db.createNotification({
    institutionKey: 'UOG',
    courseKey: 'CIS*1500',
    termKey: 'F19',
    contact: 'kanoa@kanoa.ca',
  });
  const notification = await db.getNotification({ id: notificationId });
  console.log(notification);
  let runCount = 0;
  for (let day = 0; day < 100; day++) {
    if (
      await db.createRun({
        notificationId,
        courseOpen: false,
        notificationSent: true,
        timestamp: new Date(`12/12/19${day}`),
      })
    ) {
      runCount++;
    }
  }
  console.log('Run count: ' + runCount);
})().catch(err => {
  console.error('Encountered a fatel error during setup', err);
});
