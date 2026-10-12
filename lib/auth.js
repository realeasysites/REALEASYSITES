const crypto = require('crypto');

const USER = process.env.ADMIN_USER || 'admin';
const PASS = process.env.ADMIN_PASSWORD || '';

// No default password: admin stays locked until ADMIN_PASSWORD (8+ chars) is set.
const isConfigured = () => PASS.length >= 8;

const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();

function checkCredentials(user, pass) {
  if (!isConfigured()) return false;
  const a = crypto.timingSafeEqual(digest(user), digest(USER));
  const b = crypto.timingSafeEqual(digest(pass), digest(PASS));
  return a && b;
}

const isAuthed = (req) => !!(req.session && req.session.admin);

function requireAdmin(req, res, next) {
  if (isAuthed(req)) return next();
  return res.redirect('/admin');
}

function requireAdminApi(req, res, next) {
  if (isAuthed(req)) return next();
  return res.status(401).json({ error: 'Not signed in' });
}

module.exports = { isConfigured, checkCredentials, isAuthed, requireAdmin, requireAdminApi };
