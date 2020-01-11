const config = require('../config.json');
const app = require('express')();

const errorHandler = err => console.error('Uncaught error', err);
process.on('unhandledRejection', errorHandler);
process.on('uncaughtException', errorHandler);

app.use(require('body-parser').json());

require('./routes')(app);

app.listen(config.port, () => console.log(`
Slotty is now running on port ${config.port}!
`));
