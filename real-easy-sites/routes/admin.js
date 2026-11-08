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

router.post('/admin/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!auth.isConfigured()) return res.redirect('/admin?e=locked');
  if (auth.checkCredentials(String(username || ''), String(password || ''))) {
    req.session.admin = true;
    return res.redirect('/admin');
  }
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

router.patch('/admin/api/leads/:id', auth.requireAdminApi, (req, res) => {
  const id = Number(req.params.id);
  const { status, notes } = req.body || {};
  const row = db.prepare('SELECT id FROM leads WHERE id = ?').get(id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (status !== undefined) {
    if (!STATUSES.includes(status)) return res.status(400).json({ error: 'Bad status' });
    db.prepare('UPDATE leads SET status = ? WHERE id = ?').run(status, id);
  }
  if (notes !== undefined) {
    db.prepare('UPDATE leads SET notes = ? WHERE id = ?').run(String(notes).slice(0, 5000), id);
  }
  res.json({ ok: true });
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
