const { initAndStart } = require('./app');

initAndStart().catch((e) => {
  console.error(e);
  process.exit(1);
});
