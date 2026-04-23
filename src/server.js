const express = require('express');
const path = require('path');
const { app, initAndStart } = require('./app');

app.use(express.static(path.join(__dirname, '..')));
app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend.html'));
});

initAndStart().catch((e) => {
  console.error(e);
  process.exit(1);
});
