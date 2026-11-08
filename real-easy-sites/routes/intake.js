const express = require('express');
const { db } = require('../db/init');
const { sendLeadAlert, sendAutoReply } = require('../lib/mailer');
const { normalizeLink, checkLink } = require('../lib/linkcheck');

const router = express.Router();

// Simple in-memory rate limit: 5 submissions per IP per hour.
const hits = new Map();
function limited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < 3600 * 1000);
  if (list.length >= 5) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  return false;
}

const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
const PLANS = ['Hosting', 'Starter', 'Growth', 'Pro', 'Not sure yet'];

router.post('/api/intake', async (req, res) => {
  const b = req.body || {};

  // Honeypot: bots fill the hidden field; pretend success.
  if (clean(b.company_website, 200)) return res.json({ ok: true });

  if (limited(req.ip)) return res.status(429).json({ error: 'Too many requests. Please call or email instead.' });

  const lead = {
    name: clean(b.name, 120),
    business: clean(b.business, 160),
    phone: clean(b.phone, 40),
    email: clean(b.email, 160),
    trade: clean(b.trade, 80),
    area: clean(b.area, 160),
    website: '',
    facebook: '',
    link_check: '',
    plan: PLANS.includes(clean(b.plan, 40)) ? clean(b.plan, 40) : '',
    message: clean(b.message, 3000),
    source: clean(b.source, 200),
  };

  if (!lead.name) return res.status(400).json({ error: 'Please add your name.' });
  if (!lead.business) return res.status(400).json({ error: 'Please add your business name.' });

  // Need at least one way to reach them: a valid email or a real-looking phone number.
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email);
  const phoneOk = lead.phone.replace(/\D/g, '').length >= 7;
  if (!emailOk && !phoneOk) return res.status(400).json({ error: 'Please add a phone number or a valid email.' });
  if (!emailOk) lead.email = '';

  // Facebook page or website: must be a real-looking page link, and must not clearly not exist.
  const parsed = normalizeLink(b.link || b.website || b.facebook);
  if (!parsed) {
    return res.status(400).json({ error: 'Please add your Facebook page or website link, like facebook.com/yourbusiness or yourbusiness.com.' });
  }
  const status = await checkLink(parsed);
  if (status === 'invalid') return res.status(400).json({ error: 'Please add a valid Facebook page or website link.' });
  if (status === 'dead') {
    return res.status(400).json({ error: "We couldn't open that link. Please check it and try again, or paste your website instead." });
  }
  if (parsed.kind === 'facebook') lead.facebook = parsed.href; else lead.website = parsed.href;
  lead.link_check = status;

  db.prepare(
    `INSERT INTO leads (name, business, phone, email, trade, area, website, facebook, link_check, plan, message, source)
     VALUES (@name, @business, @phone, @email, @trade, @area, @website, @facebook, @link_check, @plan, @message, @source)`
  ).run(lead);

  // Respond immediately; email is best-effort and never blocks the visitor.
  res.json({ ok: true });
  sendLeadAlert(lead).catch((e) => console.error('lead alert failed:', e.message));
  sendAutoReply(lead).catch((e) => console.error('auto-reply failed:', e.message));
});

module.exports = router;
