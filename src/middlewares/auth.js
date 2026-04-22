const { isAdmin } = require('../utils/security');

function requireAdminFactory({ adminPin, sessionSecret }) {
  return (req, res, next) => {
    if (!isAdmin(req, adminPin, sessionSecret)) return res.redirect('/admin/login');
    return next();
  };
}

module.exports = { requireAdminFactory };
