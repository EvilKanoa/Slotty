module.exports = app => {
    // ensure frontend route is registered first
    require('./frontend')(app);

    app.get('/test', (_req, res) => {
        res.json({ test: 'oh yeah bby' });
    });
};
