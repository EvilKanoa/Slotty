/**
 * Provides access to a simple persisted key-based data store.
 * Can be used with multiple "engines" but currently only supports localStorage.
 */
export class Storage {
  /**
   * Defines the prefix to use for each key in the data store when accessed through this object.
   * @type {String}
   */
  prefix = '';

  /**
   * Defines the object containing the functions used to directly save and get information from the storage engine.
   * Based upon the interface exposed by localStorage.
   */
  engine = null;

  /**
   * Create a new data store based upon the given prefix and, optionally, engine.
   * @param {String} [prefix='i_should_set_this'] The prefix to use when creating keys for this data store. Set it to something descriptive.
   * @param {Object} [engine=localStorage] If an engine other than localStorage is wanted, you should pass it here.
   */
  constructor(prefix = 'i_should_set_this', engine = localStorage) {
    this.prefix = prefix;
    this.engine = engine;
  }

  /**
   * Generates the full key string.
   * @param {String} key The specific string to define the key.
   * @returns {String} The full key string.
   * @private
   */
  makeKey = key => `${this.prefix}${key}`;

  /**
   * Custom method to serialize data for our data store.
   * @param {*} data The data to serialize.
   * @returns {String} A serialized version of data.
   * @private
   */
  serialize = data => JSON.stringify(data);

  /**
   * Custom method to deserialize data from our data store.
   * @param {String} data The data to deserialize.
   * @returns {*} The true data.
   * @private
   */
  deserialize = data => JSON.parse(data);

  /**
   * Saves some value to the data store with the given key.
   * The value will be serialized before being saved and the key will be converted to a fully defined key name.
   * @param {String} key The unique identifier for this data.
   * @param {*} value The actual data to save to the data store.
   * @returns {Boolean} Whether the value was saved to the data store successfully.
   */
  set = (key, value) => {
    if (!key) return false;

    try {
      this.engine.setItem(this.makeKey(key), this.serialize(value));
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  /**
   * Retrieves some value based upon a given key from the data store.
   * The value will be deserialized before being returned.
   * @param {String} key The unique identifier for the data in question that was specified when it was saved.
   * @param {*} [fallback] The value to use when no value was found in the data store.
   * @returns {*} The saved value, or, if an error occurs or the value doesn't exist, undefined.
   */
  get = (key, fallback) => {
    if (!key) return undefined;

    try {
      const value = this.deserialize(this.engine.getItem(this.makeKey(key)));
      return value === null ? fallback : value; // localStorage returns null not undefined on missing values
    } catch (err) {
      console.error(err);
      return undefined;
    }
  };
}

export default new Storage('slotty_storage_');
