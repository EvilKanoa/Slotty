module.exports = {
  /**
   * Generates a new random access key of the specified length.
   * @param {Number} length The length of the key to generate
   * @param {String|Array<String>} chars List of possible characters to use.
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
};
