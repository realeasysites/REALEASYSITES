const express = require('express');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: false, limit: '50kb' }));

const secret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) console.warn('SESSION_SECRET not set: admin sessions reset on every restart.');

app.use(
  session({
    name: 'res.sid',
    secret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 8,
    },
  })
);

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.get('/healthz', (req, res) => res.send('ok'));

// Website traffic: visitors, sources and call/text taps on the admin dashboard (see site-analytics/README.md).
const { db } = require('./db/init');
const { isAuthed, requireAdminApi } = require('./lib/auth');
require('./site-analytics')(app, { db, isAuthed, requireAdmin: requireAdminApi, timezone: 'America/New_York' });

app.use(require('./routes/intake'));
app.use(require('./routes/admin'));

// Serve the home page with the site URL filled into the social-share tags.
const fs = require('fs');
const homeHtml = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');
app.get(['/', '/index.html'], (req, res) => {
  // Facebook needs absolute URLs. Use SITE_URL if set, otherwise the address the visitor (or crawler) used.
  const base = siteUrl || (req.protocol + '://' + req.get('host'));
  res.type('html').send(homeHtml.replace(/__SITE_URL__/g, base));
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: '1h' }));

app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Real Easy Sites listening on ${port}`));
