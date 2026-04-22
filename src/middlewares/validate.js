function validate(checker, source = 'body') {
  return (req, res, next) => {
    try {
      const payload = req[source] || {};
      const message = checker(payload, req);
      if (message) return res.status(400).json({ ok: false, message });
      return next();
    } catch (e) {
      return next(e);
    }
  };
}

module.exports = { validate };
