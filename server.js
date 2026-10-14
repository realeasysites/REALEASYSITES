const express = require('express');
const path = require('path');
const crypto = require('crypto');
const session = require('express-session');
let compression = null;
try { compression = require('compression'); } catch (e) { console.warn('compression not installed; responses are sent uncompressed.'); }

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
if (compression) app.use(compression());

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
  // Keep private/utility URLs out of search results.
  if (/^\/(admin|api|sa)(\/|$)/.test(req.path)) res.set('X-Robots-Tag', 'noindex, nofollow');
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


// ---- Search and AI-crawler files: robots.txt, sitemap.xml, llms.txt ----
const baseUrl = (req) => siteUrl || (req.protocol + '://' + req.get('host'));
const lastMod = fs.statSync(path.join(__dirname, 'public', 'index.html')).mtime.toISOString().slice(0, 10);

app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(
    [
      '# Search engines and AI assistants (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, etc.) are welcome on the public site.',
      'User-agent: *',
      'Allow: /',
      'Disallow: /admin',
      'Disallow: /api/',
      'Disallow: /sa/',
      '',
      'Sitemap: ' + baseUrl(req) + '/sitemap.xml',
      '',
    ].join('\n')
  );
});

app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').send(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
      '  <url><loc>' + baseUrl(req) + '/</loc><lastmod>' + lastMod + '</lastmod><changefreq>monthly</changefreq><priority>1.0</priority></url>\n' +
      '</urlset>\n'
  );
});

app.get('/llms.txt', (req, res) => {
  const b = baseUrl(req);
  res.type('text/plain').send(
    [
      '# Real Easy Sites',
      '',
      '> Real Easy Sites builds fast, mobile-friendly websites for trade and home-service businesses (plumbers, builders, roofers, HVAC, electricians, landscapers, excavation, cleaners). Based in Maine, serving businesses anywhere in the U.S. Every site includes hosting, a lead dashboard for form inquiries, and ongoing edits for one monthly price. A free mockup comes first, with no obligation.',
      '',
      '## Key pages',
      '',
      '- [Home](' + b + '/): overview, free mockup request form, plans and pricing, FAQ',
      '- [Client work](' + b + '/#work): example sites built for trade businesses',
      '- [Plans and pricing](' + b + '/#plans): Hosting $49/mo ($399 one-time move-over), Starter $75/mo ($500 setup), Growth $125/mo ($1,000 setup), Pro $199/mo ($1,500 setup)',
      '- [What each part means](' + b + '/#included): plain-English explanation of hosting, SEO, the lead dashboard, Google Business Profile and Google Ads',
      '- [FAQ](' + b + '/#faq): mockup, ownership of your domain, changing plans',
      '',
      '## Facts',
      '',
      '- Business domain names are always owned by the customer.',
      '- No promises about search rankings or call volume. Google Ads budget is paid directly to Google.',
      '- Contact: realeasy365@gmail.com, or use the free mockup form on the home page.',
      '',
    ].join('\n')
  );
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: '1h' }));

app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', '404.html')));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Real Easy Sites listening on ${port}`));
