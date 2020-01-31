const _ = require('lodash');
const { GraphQLClient } = require('graphql-request');
const db = require('./db');

/**
 * Defines the GraphQL query that is used to retrieve the current number of available slots for a given course.
 * Must be used with the following variables object: { institutionKey, courseKey, termKey }.
 * @type {String}
 */
const slotsQuery = `
  query Slots(
    $courseKey: String!
    $termKey: Term!
    $institutionKey: School!
  ) {
    course(
      code: $courseKey
      institution: $institutionKey
      term: $termKey
    ) {
      sections {
        id
        available
        capacity
        meetings {
          type
          name
          available
          capacity
        }
      }
    }
  }
`;

/**
 * Handles actual notification checking and sending for Slotty.
 * Can be ran as a recurring action that checks if any courses being
 * watched have new open slots and sends any required notifications.
 * @class
 */
class Worker {
  /**
   * Contains the ID of the interval being used to run this worker.
   * @type {(Number|undefined)}
   */
  intervalID = undefined;

  /**
   * Holds an instance of a GraphQLClient that can be used to perform course lookups.
   * This value should never be undefined after instance construction.
   * @type {GraphQLClient}
   */
  gql = undefined;

  /**
   * Controls the interval value used with setInterval when executing this worker.
   * Note: Please is `interval` to access and set this value.
   * @private
   * @type {Number}
   */
  _interval = 0;

  /**
   * Get the interval used between each execution of this worker.
   * @returns {Number} The current worker interval in milliseconds.
   */
  get interval() {
    return this._interval;
  }

  /**
   * Sets the interval between each execution of this worker, will take effect right away.
   * Note: To ensure the new value takes effect, the worker is restarted when setting this value.
   * @param {Number} intervalValue The new value in milliseconds.
   */
  set interval(intervalValue) {
    // set our internal value
    this._interval = intervalValue;

    // check if we need to restart the worker to allow the new interval to take effect
    if (this.isRunning) {
      this.start();
    }
  }

  /**
   * Check if this worker instance is currently running.
   * @returns {Boolean} True when this worker instance is running.
   */
  get isRunning() {
    return this.intervalID !== undefined;
  }

  /**
   * Creates a new worker instance with the given parameters.
   * Note: You must call worker.start() to begin running your worker.
   * @param {Number} interval The duration between executions of this worker in milliseconds.
   */
  constructor(interval, webadvisorApi) {
    this.gql = new GraphQLClient(webadvisorApi, { mode: 'cors' });
    this._interval = interval;
  }

  /**
   * Starts this worker instance running.
   * Note: If this function is called while the worker is already running, the worker will be restarted.
   * This method returns the worker instance and thus can be chained.
   * @returns {this} This worker for chaining.
   */
  start() {
    // check if this worker is already running
    if (this.intervalID !== undefined) {
      // stop the worker before re-starting it
      this.stop();
    }

    // start the new interval and save the id (need to use an arrow function to keep `this` binded to the worker instance)
    this.intervalID = setInterval(() => this.intervalHandler(), this.interval);

    return this;
  }

  /**
   * Stops this worker instance from running.
   * Note: If worker is already stopped, this has no effect.
   * This method returns the worker instance and thus can be chained.
   * @returns {this} This worker for chaining.
   */
  stop() {
    // check if this worker is already stopped
    if (this.intervalID === undefined) {
      return;
    }

    // stop this worker
    clearInterval(this.intervalID);
    // reset the interval id
    this.intervalID = undefined;

    return this;
  }

  /**
   * Handler function that is registered with setInterval to execute this worker.
   * @private
   * @returns {Promise<Number>} Resolves if check completes successfully with the number of notifications sent.
   */
  async performSlotCheck() {
    // 1. make DB call to list all notifications needing a check
    // 2. generate set of all courses that are of interest (based on sections, hashtable?)
    // 3. make a fetch for each course in parallel
    // 4. for each course fetch, perform action required for each relating notification

    // this function handles step 4 from above, it will perform actions on an individual notification basis
    const performSingleCheck = async (notification, data) => {
      console.log('Perform action...', { notification, data });
    };

    // the following two variables achieve step 1 from above
    // grab all active notifications (TODO: use limiting if required for performance)
    const notifications = await db.listActiveNotifications();
    // now generate an object identifying each course and a list of its dependent notifications per institution->course->term
    const notificationsByCourse = _(notifications)
      .groupBy('institutionKey')
      .mapValues(notifications =>
        _(notifications)
          .groupBy('courseKey')
          .mapValues(notifications => _.groupBy(notifications, 'termKey'))
          .value()
      )
      .value();

    // generate the list of requests that are being made (which is step 2)
    const requests = _(notificationsByCourse)
      .flatMap((courses, institutionKey) =>
        _.flatMap(courses, (courses, courseKey) =>
          _(courses)
            .keys()
            .map(termKey => ({ institutionKey, courseKey, termKey }))
            .value()
        )
      )
      // the above resulted in an array of objects with the keys for institution, course, and term
      .filter(req => req.institutionKey && req.courseKey && req.termKey)
      .map(async variables => {
        // make the fetch request for an individual course (course, institution, and term are variables)
        // this request is step 3 from above
        const data = await this.gql
          .request(slotsQuery, variables)
          .catch(err => {
            // output any graphql errors that occur
            console.log(
              'Encountered error while fetching slot data using variables: ',
              variables
            );
            console.error(err.response.errors);

            // return a falsey value so we are aware that an issue has occured
            return undefined;
          });

        // exit early if an error occured
        if (!data) {
          return 0;
        }

        // perform actions for each individual notification and return promises for each
        const { institutionKey, courseKey, termKey } = variables;
        const actions = _.map(
          notificationsByCourse[institutionKey][courseKey][termKey],
          notification =>
            // now that we have info for a course, we need to perform actions for each notification dependent on that course
            // this calls the function that performs step 4 from above
            performSingleCheck(notification, data)
              .then(sent => (typeof sent === 'number' ? sent : 1))
              .catch(err => {
                console.log(
                  'Encountered error while performing action on a notification',
                  { notification, data }
                );
                console.error(err);
                return 0;
              })
        );

        // return the combined actions and once they're complete, calculate the count of successes
        return Promise.allSettled(actions).then(results =>
          _(results)
            .map(({ value }) => value || 0)
            .sum()
        );
      })
      .value();

    // return the combined requests and again compute the count of successes overall
    return Promise.allSettled(requests).then(results =>
      _(results)
        .map(({ value }) => value || 0)
        .sum()
    );
  }

  /**
   * Handler function that is invoked by setInterval and is responsible for call performSlotCheck().
   * Wraps performSlotCheck in an error handler and logger.
   * @private
   * @returns {undefined}
   */
  intervalHandler() {
    console.log('\nWorker task starting execution...');

    // execute the slot check and attach handlers for success and failure conditions
    this.performSlotCheck()
      .then((numSent = 0) =>
        console.log(
          `Worker task ran successfully, ${numSent} notifications were sent.`
        )
      )
      .catch(err => {
        console.log('Worker task encountered an error.');
        console.error(err);
      });
  }
}

// export the class directly so we can create multiple instances if needed
module.exports = Worker;
