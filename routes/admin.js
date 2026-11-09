const express = require('express');
const path = require('path');
const { db } = require('../db/init');
const auth = require('../lib/auth');

const router = express.Router();
const STATUSES = ['new', 'contacted', 'mockup_sent', 'won', 'lost'];
const view = (f) => path.join(__dirname, '..', 'views', f);

router.get('/admin', (req, res) => {
  res.set('Cache-Control', 'no-store');
  if (auth.isAuthed(req)) return res.sendFile(view('admin.html'));
  res.sendFile(view('login.html'));
});

router.get('/admin/status', (req, res) => {
  res.json({ configured: auth.isConfigured() });
});

// Simple brute-force guard: 10 wrong passwords per IP per 15 minutes.
const fails = new Map();
const tooMany = (ip) => (fails.get(ip) || []).filter((t) => Date.now() - t < 15 * 60 * 1000).length >= 10;

router.post('/admin/login', (req, res) => {
  const { password } = req.body || {};
  if (!auth.isConfigured()) return res.redirect('/admin?e=locked');
  if (tooMany(req.ip)) return res.redirect('/admin?e=wait');
  if (auth.checkPassword(String(password || ''))) {
    fails.delete(req.ip);
    return req.session.regenerate(() => {
      req.session.admin = true;
      res.redirect('/admin');
    });
  }
  fails.set(req.ip, (fails.get(req.ip) || []).filter((t) => Date.now() - t < 15 * 60 * 1000).concat(Date.now()));
  return res.redirect('/admin?e=bad');
});

router.post('/admin/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/admin'));
});

router.get('/admin/api/leads', auth.requireAdminApi, (req, res) => {
  const leads = db.prepare('SELECT * FROM leads ORDER BY id DESC').all();
  const count = (sql) => db.prepare(sql).get().n;
  const total = leads.length;
  const won = count("SELECT COUNT(*) n FROM leads WHERE status='won'");
  const lost = count("SELECT COUNT(*) n FROM leads WHERE status='lost'");
  const stats = {
    total,
    last7: count("SELECT COUNT(*) n FROM leads WHERE created_at >= datetime('now','-7 days')"),
    last30: count("SELECT COUNT(*) n FROM leads WHERE created_at >= datetime('now','-30 days')"),
    waiting: count("SELECT COUNT(*) n FROM leads WHERE status='new'"),
    stale: count("SELECT COUNT(*) n FROM leads WHERE status='new' AND created_at <= datetime('now','-1 day')"),
    won,
    winRate: won + lost ? Math.round((won / (won + lost)) * 100) : null,
  };
  res.json({ leads, stats });
});

// Fields that can be corrected from the dashboard, with max lengths.
const EDITABLE = { name: 120, business: 160, phone: 40, email: 160, trade: 80, area: 160, website: 300, facebook: 300, plan: 40, message: 3000, notes: 5000 };

router.patch('/admin/api/leads/:id', auth.requireAdminApi, (req, res) => {
  const id = Number(req.params.id);
  const b = req.body || {};
  const row = db.prepare('SELECT id FROM leads WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (b.status !== undefined && !STATUSES.includes(b.status)) return res.status(400).json({ error: 'Bad status' });

  const sets = {};
  if (b.status !== undefined) sets.status = b.status;
  for (const k of Object.keys(EDITABLE)) {
    if (b[k] !== undefined) sets[k] = String(b[k] == null ? '' : b[k]).trim().slice(0, EDITABLE[k]);
  }
  if (sets.name !== undefined && !sets.name) return res.status(400).json({ error: 'Name cannot be empty.' });
  const keys = Object.keys(sets);
  if (!keys.length) return res.json({ ok: true });
  db.prepare('UPDATE leads SET ' + keys.map((k) => k + ' = @' + k).join(', ') + ' WHERE id = @id').run({ ...sets, id });
  res.json({ ok: true, lead: db.prepare('SELECT * FROM leads WHERE id = ?').get(id) });
});

router.delete('/admin/api/leads/:id', auth.requireAdminApi, (req, res) => {
  const info = db.prepare('DELETE FROM leads WHERE id = ?').run(Number(req.params.id));
  if (!info.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// Remove several at once (for spam or test entries).
router.post('/admin/api/leads/delete', auth.requireAdminApi, (req, res) => {
  const ids = (Array.isArray((req.body || {}).ids) ? req.body.ids : []).map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 500);
  if (!ids.length) return res.status(400).json({ error: 'Nothing selected' });
  const del = db.prepare('DELETE FROM leads WHERE id = ?');
  let n = 0;
  db.transaction(() => { for (const i of ids) n += del.run(i).changes; })();
  res.json({ ok: true, deleted: n });
});

router.get('/admin/api/leads.csv', auth.requireAdminApi, (req, res) => {
  const rows = db.prepare('SELECT * FROM leads ORDER BY id DESC').all();
  const cols = ['id', 'created_at', 'status', 'name', 'business', 'phone', 'email', 'trade', 'area', 'facebook', 'website', 'link_check', 'plan', 'message', 'source', 'notes'];
  // Prefix formula-leading characters so spreadsheets do not execute them.
  const q = (v) => {
    let s = String(v == null ? '' : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  };
  const csv = [cols.join(',')].concat(rows.map((r) => cols.map((c) => q(r[c])).join(','))).join('\r\n');
  res.set('Content-Type', 'text/csv; charset=utf-8');
  res.set('Content-Disposition', 'attachment; filename="real-easy-sites-leads.csv"');
  res.send(csv);
});

module.exports = router;
