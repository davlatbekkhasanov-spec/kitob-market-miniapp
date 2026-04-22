async function syncDalionStock() {
  return { ok: true, synced: 0, message: 'Dalion sync tayyor (hozircha passiv)' };
}

module.exports = { syncDalionStock };
