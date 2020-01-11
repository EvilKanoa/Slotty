const express = require('express');

module.exports = app => {
    // serve up all files in the 'frontend' directory statically
    app.use(express.static('frontend'));
};
