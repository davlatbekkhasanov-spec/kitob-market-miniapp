const { syncDalionStock } = require('../services/dalionSyncService');

async function runDalionSyncJob() {
  return syncDalionStock();
}

module.exports = { runDalionSyncJob };
