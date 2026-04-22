function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const message = err && err.message ? err.message : "Noma'lum xatolik";
  res.status(500).json({ ok: false, message });
}

module.exports = { errorHandler };
