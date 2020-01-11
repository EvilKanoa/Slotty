const express = require('express');

module.exports = app => {
  // serve up all files in the 'frontend' directory statically
  // this provides a simple HTTP server
  app.use(express.static('frontend'));

  // api route: testing
  app.get('/test', (_req, res) => {
    res.json({ test: 'oh yeah bby' });
  });
};
