function basicRateLimit({ windowMs = 60 * 1000, max = 240 } = {}) {
  const map = new Map();
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const row = map.get(key) || { count: 0, expiresAt: now + windowMs };
    if (now > row.expiresAt) {
      row.count = 0;
      row.expiresAt = now + windowMs;
    }
    row.count += 1;
    map.set(key, row);
    if (row.count > max) {
      return res.status(429).send('Juda ko\'p so\'rov yuborildi. Keyinroq urinib ko\'ring.');
    }
    return next();
  };
}

module.exports = { basicRateLimit };
