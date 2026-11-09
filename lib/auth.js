const crypto = require('crypto');

// Password-only admin login. ADMIN_USER is no longer used.
const PASS = process.env.ADMIN_PASSWORD || '';

// No default password: admin stays locked until ADMIN_PASSWORD is set in Render.
const isConfigured = () => PASS.length > 0;

const digest = (s) => crypto.createHash('sha256').update(String(s)).digest();

function checkPassword(pass) {
  if (!isConfigured()) return false;
  return crypto.timingSafeEqual(digest(pass), digest(PASS));
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

module.exports = { isConfigured, checkPassword, isAuthed, requireAdmin, requireAdminApi };
