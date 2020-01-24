const config = require('../config');

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
  constructor(interval) {
    this._interval = interval;
  }

  /**
   * Starts this worker instance running.
   * Note: If this function is called while the worker is already running, the worker will be restarted.
   * @returns {undefined}
   */
  start() {
    // check if this worker is already running
    if (this.intervalID !== undefined) {
      // stop the worker before re-starting it
      this.stop();
    }

    this.intervalID = setInterval(this.intervalHandler);
  }

  /**
   * Stops this worker instance from running.
   * Note: If worker is already stopped, this has no effect.
   * @returns {undefined}
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
  }

  /**
   * Handler function that is registered with setInterval to execute this worker.
   * @private
   * @returns {undefined}
   */
  intervalHandler() {
    console.log('Worker executing');
  }
}

// export the class directly so we can create multiple instances if needed
module.exports = Worker;
