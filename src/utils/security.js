const crypto = require('crypto');

function isSecureRequest(req) {
  return Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
}

function secureCookieOptions(req, maxAge) {
  return { httpOnly: true, sameSite: 'lax', secure: isSecureRequest(req), maxAge };
}

function signedAdminValue(adminPin, sessionSecret) {
  return crypto.createHash('sha256').update(`${adminPin}|${sessionSecret}`).digest('hex');
}

function safeEqual(a = '', b = '') {
  const av = Buffer.from(String(a));
  const bv = Buffer.from(String(b));
  if (av.length !== bv.length) return false;
  return crypto.timingSafeEqual(av, bv);
}

function isAdmin(req, adminPin, sessionSecret) {
  const expected = signedAdminValue(adminPin, sessionSecret);
  return safeEqual(req.signedCookies?.admin || '', expected);
}

module.exports = { isSecureRequest, secureCookieOptions, signedAdminValue, isAdmin, safeEqual };
