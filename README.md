# Real Easy Sites

One-page marketing site with plans and an intake form, plus an admin lead dashboard. Same pattern as the client sites (Node/Express + SQLite).

## Edit without touching code
`public/js/config.js` holds the plan prices (display copy lives in `public/index.html`), the contact email and the client-work cards.

## Plans shown
| Plan | Setup | Monthly |
|---|---|---|
| Hosting | $399 (move-over) | $49 |
| Starter | $750 | $75 |
| Growth | $1,000 | $125 |
| Pro | $1,500 | $199 |

The Hosting move-over means rebuilding the client's existing site on our template (same content and look) so it gets the lead form, alerts and dashboard. We do not host third-party builds as-is.

Exactly what each monthly fee covers is in the "No surprises" table on the home page (`#coverage`).

### Add-ons (not part of any monthly fee unless noted)
| Add-on | Price | Plans |
|---|---|---|
| Extra small edit (photo/logo swap, text, hours) | $40 each | All (Hosting has no included edits) |
| New page / we write the page text | $200 / +$100 | All |
| New form (job application, booking) | $150 (included in Pro) | All |
| Google Business Profile setup or cleanup | $250 one-time (included in Pro) | All |
| Google Business Profile upkeep | $49/mo (included in Pro) | All |
| Google Ads management | $299 setup + $249/mo ($199/mo on Pro); one campaign up to $1,500/mo ad spend, 10% of spend above that | All |
| Blog setup / post we write | $350 / $125 per post (posting one they send = 1 edit) | Growth, Pro |
| Simple online store (up to 20 products) | $999 + $25/mo | Growth, Pro |
| Full online store | $2,000+ and from $49/mo by catalog size | Growth, Pro |

If you change prices, update them in `index.html` (plan cards and the form dropdown) and the `PLANS` list in `routes/intake.js` and `config.js`.

## Render setup
- Build: `npm install` · Start: `npm start` · Node 20.x (pinned in `.node-version` and `package.json`)
- Persistent disk mounted at `/var/data`, env `DB_PATH=/var/data/res.sqlite`
- Env vars: `NODE_ENV=production`, `SITE_URL`, `NOTIFY_EMAIL`, `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_SECURE=true`, `SMTP_USER`, `SMTP_PASS` (Gmail app password), `ADMIN_USER`, `ADMIN_PASSWORD` (8+ chars), `SESSION_SECRET`
- Admin is locked until `ADMIN_PASSWORD` is set. There is no default password.

## Lead flow
Form posts to `/api/intake`, saves to SQLite, emails `NOTIFY_EMAIL` (reply goes to the customer) and sends the customer an auto-reply. Dashboard at `/admin`: statuses, notes, 7/30-day counts, waiting-over-24h warning, one-tap call/text/email, CSV export.

## Facebook page or website check
Both forms require a Facebook page or website link. The server (`lib/linkcheck.js`) rejects anything that is not a real page link (for example bare facebook.com, login links, localhost or private addresses), then tries to open it. It rejects only when the address clearly does not exist (no DNS record, or a 404/410). Facebook and many sites block automated checks, so unclear results are accepted and marked "Could not auto-verify" on the lead. The check runs on the server, so it works on Render; it could not be tested from the build sandbox.

## Tip
Tag outreach links with `?utm_source=...` and the source shows on each lead.

## Client work videos
The three cards on the home page play short scrolling videos from `public/video/` (`loria`, `mps207`, `barry-larrys`: an `.mp4` plus a `.jpg` poster each). To update one, replace those files with the same names (MP4, no audio, about 1280x720, under 3MB) and redeploy. To add or remove a card, edit the `work` list in `public/js/config.js`. Videos only load and play while on screen, and visitors with reduced-motion turned on see the still poster.

## Website traffic (site-analytics)
The `/admin` dashboard shows a "Website traffic" panel above the mockup requests: visitors, page views, call/text/email taps, form leads, contact rate, where visitors came from, top pages and phone vs computer, for 7/30/90 days. It is the same `site-analytics/` module used on MPS207 (details in `site-analytics/README.md`).

- No cookies, no stored IPs, no outside service. Data lives in the same SQLite file, so the persistent disk (`DB_PATH`) is required or traffic history resets on every deploy.
- Bots, link previews and your own logged-in admin visits are not counted. To stop counting your phone, open the site once with `#notrack` on the end.
- Tag links so sources show up by name: `?utm_source=gbp` on your Google Business Profile website link, `?utm_source=qr` on flyers.
- For Growth and Pro clients, copy `site-analytics/` into their project and follow its README (about 5 minutes per site).
