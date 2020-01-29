const utils = (module.exports = {
  /**
   * Generates a new random access key of the specified length.
   * @param {Number} [length=8] The length of the key to generate
   * @param {String|Array<String>} [chars='abcdefghijklmnopqrstuvwxyz0123456789'] List of possible characters to use.
   * @returns {String} A random access key.
   */
  generateAccessKey: (
    length = 8,
    chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  ) => {
    let key = '';
    for (let i = 0; i < length; i++) {
      key = key + chars[Math.floor(Math.random() * chars.length)];
    }
    return key;
  },

  /**
   * Converts a snake case string, a kabob case string, or an array of words to a camel case string.
   * @param {(String|Array<String>)} input The input word/words to convert to camel case.
   * @returns {String} A camel cased version of input.
   */
  camelCase: input => {
    // get an array of words from the input
    const words = Array.isArray(input)
      ? input.map(word => utils.camelCase(word)) // if input is array, camel case each word
      : input.includes('_') // if input is string, check if snake or kabob case
      ? input.split('_') // if _ found, then assume snake case
      : input.split('-'); // else, assume kabob case

    // convert the array of words to a camel case string and return it
    return words
      .filter(word => typeof word === 'string' && word.length > 0)
      .map(word => word.toLowerCase())
      .reduceRight(
        (acc, word) => `${word}${acc.charAt(0).toUpperCase()}${acc.slice}`
      );
  },

  /**
   * Converts a camel case string or an array of words to a snake case string.
   * @param {(String|Array<String>)} input The input word/words to convert to snake case.
   * @param {Boolean} [screaming=false] Set to true for all upper case output.
   * @returns {String} A snake cased version of input.
   */
  snakeCase: (input, screaming = false) => {
    // get an array of words from the input
    const words = Array.isArray(input)
      ? input.map(word => utils.snakeCase(word)) // if input is array, snake case each entry
      : input.split(/(?<=[a-z])(?=[A-Z])/gm); // if string, assume camel case and split into words

    // convert the array of words to a snake case string and return it
    return words
      .filter(word => typeof word === 'string' && word.length > 0)
      .map(word => (screaming ? word.toUpperCase() : word.toLowerCase()))
      .join('_');
  },

  /**
   * Generates a list recursively of all keys for primitive values (or arrays) present in an object.
   * If a key belongs to some child object, a dot ('.') will be used in the key name.
   * Circular references will only be resolved one way once and then ignored.
   * If the same object is referenced by multiple keys within obj, only one key per object will be returned.
   * @param {Object} obj The object to generate a list of keys that belong to it.
   * @returns {Array<String>} List of all keys present in obj.
   */
  getPrimitiveKeys: (obj, history = []) => {
    // handle circular refs by only recording them once
    if (history.includes(obj)) {
      console.warn(
        'Encountered an infinite reference loop while getting keys for object.'
      );

      // if we've already looked at this object, return early
      return [];
    } else {
      // record this object since we're now looking at it
      history.push(obj);
    }

    // iterate through all keys present in obj at this level
    const keys = [];
    Object.keys(obj).forEach(key => {
      // ignore inherited properties
      if (!obj.hasOwnProperty(key)) {
        return;
      }

      // check if we need to recurse the object
      if (typeof obj[key] === 'object') {
        // if found another object, then get all child keys and prefix with parent key
        keys.push(
          ...utils
            .getPrimitiveKeys(obj[key], history)
            .map(childKey => `${key}.${childKey}`)
        );
      } else {
        keys.push(key);
      }
    });

    // return the built list of keys
    return keys;
  },

  /**
   * Takes a date or date like object as input and returns an integer representing the number of seconds since the unix epoch.
   * Note: Despite referencing the unix epoch, this actually is based on the ECMAScript epoch which is currently the same.
   * @param {(Date|Number|String)} dateLike The date to parse. Can be passed as a Date object, a date string, or an epoch integer. Note that this is parsed using the nasty new Date(...) constructor.
   * @returns {Number} The number of seconds since the unix epoch.
   */
  toUnixEpoch: dateLike => Math.floor(new Date(dateLike).valueOf() / 1000),
});
