module.exports = {
  /**
   * Provides a wrapper around the app environment.
   */
  isDev: process.env.NODE_ENV === 'development',

  /**
   * Defines the port that slotty will bind its web and API server to by default.
   * If the environment variable "PORT" has been set, it will override this value.
   */
  port: 8080,

  /**
   * Defines what file should back the SQLite database depending on the mode of the app.
   * It is highly recommended to use a file-based location for production so data persists
   * accross app reboots (and crashes). When developing, it may be faster to simply use the
   * in-memory option.
   */
  db: {
    dev: ':memory:',
    prod: './slotty.db',
  },
};
