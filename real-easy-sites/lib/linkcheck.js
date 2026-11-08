const dns = require('dns').promises;
const net = require('net');

const FB_HOSTS = new Set([
  'facebook.com', 'www.facebook.com', 'm.facebook.com', 'web.facebook.com', 'mbasic.facebook.com', 'fb.com', 'www.fb.com', 'fb.me',
]);
const FB_RESERVED = /^(login|login\.php|home\.php|sharer|sharer\.php|share|dialog|plugins|tr|l\.php|recover|help|policies)$/i;

// Turn what a visitor typed into a clean URL, or null if it is not a usable page link.
function normalizeLink(raw) {
  let s = String(raw == null ? '' : raw).trim().slice(0, 300);
  if (!s || /\s/.test(s)) return null;
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s.replace(/^\/\//, '');
  let u;
  try { u = new URL(s); } catch (e) { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  if (u.port && u.port !== '80' && u.port !== '443') return null;
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (net.isIP(host)) return null;
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host)) return null;
  const tld = host.split('.').pop();
  if (tld.length < 2) return null;

  if (FB_HOSTS.has(host)) {
    const segs = u.pathname.split('/').filter(Boolean);
    const id = u.searchParams.get('id') || '';
    const profileById = segs[0] === 'profile.php' && /^\d+$/.test(id);
    if (!segs.length) return null;                       // facebook.com alone is not a page
    if (segs[0] === 'profile.php' && !profileById) return null;
    if (!profileById && FB_RESERVED.test(segs[0])) return null;
    const href = 'https://' + (host === 'fb.me' ? 'fb.me' : 'www.facebook.com') + '/' + segs.join('/') + (profileById ? '?id=' + id : '');
    return { kind: 'facebook', href, url: new URL(href) };
  }
  u.hash = '';
  return { kind: 'website', href: u.href, url: u };
}

function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  const v = ip.toLowerCase();
  if (v === '::' || v === '::1') return true;
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return /^f[cd]/.test(v) || /^fe[89ab]/.test(v) || v.startsWith('ff');
}

// Best-effort live check. Returns 'verified' | 'unverified' | 'dead' | 'invalid'.
// 'dead' only when the address clearly does not exist (no DNS record, or HTTP 404/410).
// Sites and Facebook often block automated checks, so anything unclear is 'unverified', not a rejection.
async function checkLink(parsed) {
  const isFb = parsed.kind === 'facebook';
  let cur = parsed.url;
  for (let hop = 0; hop < 4; hop++) {
    let addrs;
    try {
      addrs = await dns.lookup(cur.hostname, { all: true });
    } catch (e) {
      return e.code === 'ENOTFOUND' || e.code === 'ENODATA' ? 'dead' : 'unverified';
    }
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) return 'invalid';

    let res;
    try {
      res = await fetch(cur.href, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
        headers: {
          'User-Agent': isFb ? 'facebookexternalhit/1.1' : 'Mozilla/5.0 (compatible; RealEasySitesLinkCheck/1.0)',
          Accept: 'text/html',
        },
      });
    } catch (e) {
      return 'unverified';
    }
    try { if (res.body) await res.body.cancel(); } catch (e) { /* ignore */ }

    const st = res.status;
    if (st >= 300 && st < 400) {
      const loc = res.headers.get('location');
      if (!loc) return 'unverified';
      let nxt;
      try { nxt = new URL(loc, cur); } catch (e) { return 'unverified'; }
      if ((nxt.protocol !== 'http:' && nxt.protocol !== 'https:') || (nxt.port && nxt.port !== '80' && nxt.port !== '443')) return 'unverified';
      if (isFb && /login|checkpoint|recover/i.test(nxt.pathname)) return 'unverified';
      cur = nxt;
      continue;
    }
    if (st === 404 || st === 410) return 'dead';
    if (st >= 200 && st < 300) return 'verified';
    return 'unverified';
  }
  return 'unverified';
}

module.exports = { normalizeLink, checkLink, isPrivateIp };
