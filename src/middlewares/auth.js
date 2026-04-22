function requireAdmin(req, res, next) {
  if (!req.signedCookies || !req.signedCookies.admin) return res.redirect('/admin/login');
  return next();
}

module.exports = { requireAdmin };
