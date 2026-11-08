(function () {
  var cfg = window.RES_CONFIG || {};
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Contact email links
  var mail = cfg.contactEmail || '';
  ['contactEmail', 'footEmail'].forEach(function (id) {
    var a = document.getElementById(id);
    if (a && mail) { a.href = 'mailto:' + mail; a.textContent = mail; }
  });

  // Client work cards
  var grid = document.getElementById('workGrid');
  if (grid && cfg.work && cfg.work.length) {
    var vids = [];
    cfg.work.forEach(function (w) {
      var a = document.createElement(w.url ? 'a' : 'div');
      a.className = 'card work';
      if (w.url) { a.href = w.url; a.target = '_blank'; a.rel = 'noopener'; }
      if (w.video || w.poster) {
        var box = document.createElement('div'); box.className = 'work-media';
        if (w.video) {
          var v = document.createElement('video');
          v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
          v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-label', w.name + ' website scrolling');
          if (w.poster) v.poster = w.poster;
          v.dataset.src = w.video; box.appendChild(v); vids.push(v);
        } else {
          var im = document.createElement('img'); im.src = w.poster; im.alt = w.name + ' website'; im.loading = 'lazy'; box.appendChild(im);
        }
        a.appendChild(box);
      }
      var t = document.createElement('p'); t.className = 'work-meta'; t.textContent = w.trade + ' · ' + w.place;
      var h = document.createElement('h3'); h.textContent = w.name;
      var n = document.createElement('p'); n.textContent = w.note || '';
      a.appendChild(t); a.appendChild(h); a.appendChild(n);
      if (w.url) {
        var l = document.createElement('span'); l.className = 'work-link';
        l.textContent = 'Visit ' + w.url.replace(/^https?:\/\//, '').replace(/\/$/, '') + ' \u2192'; a.appendChild(l);
      }
      grid.appendChild(a);
    });
    // Load and play each video only while it is on screen; respect reduced-motion (poster only)
    var still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!still && 'IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          var v = e.target;
          if (e.isIntersecting) { if (!v.src) v.src = v.dataset.src; var p = v.play(); if (p && p.catch) p.catch(function () {}); }
          else v.pause();
        });
      }, { threshold: 0.35 });
      vids.forEach(function (v) { io.observe(v); });
    }
  } else if (grid) {
    document.getElementById('work').style.display = 'none';
  }

  // Plan buttons preselect the full form
  var planSel = document.getElementById('planSelect');
  document.querySelectorAll('[data-plan]').forEach(function (b) {
    b.addEventListener('click', function () { if (planSel) planSel.value = b.getAttribute('data-plan'); });
  });

  // Sticky mobile button: go to the hero form while it is on screen's way, else the bottom form
  var sticky = document.getElementById('stickyCta');
  var quick = document.getElementById('quick');
  if (sticky && quick && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (es) {
      es.forEach(function (e) { sticky.setAttribute('href', e.isIntersecting || e.boundingClientRect.top > 0 ? '#quick' : '#mockup'); });
    }).observe(quick);
  }

  // Lead source from UTMs / referrer
  var q = new URLSearchParams(location.search);
  var parts = [];
  ['utm_source', 'utm_medium', 'utm_campaign'].forEach(function (k) { if (q.get(k)) parts.push(k.replace('utm_', '') + '=' + q.get(k)); });
  if (!parts.length && document.referrer) {
    try { parts.push('ref=' + new URL(document.referrer).hostname); } catch (e) {}
  }
  var baseSource = parts.join(' ') || 'direct';
  var srcInput = document.querySelector('#intakeForm input[name="source"]');
  if (srcInput) srcInput.value = baseSource + ' | form';

  // Same shape rules the server applies (the server is the real check).
  var LINK_MSG = 'Please add your Facebook page or website link, like facebook.com/yourbusiness or yourbusiness.com.';
  function linkOk(v) {
    v = String(v || '').trim();
    if (!v || /\s/.test(v)) return false;
    if (!/^https?:\/\//i.test(v)) v = 'https://' + v.replace(/^\/\//, '');
    var u; try { u = new URL(v); } catch (e) { return false; }
    var h = u.hostname.toLowerCase();
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) || h.split('.').pop().length < 2) return false;
    if (/^(www\.|m\.|web\.|mbasic\.)?(facebook\.com|fb\.com|fb\.me)$/.test(h)) {
      var segs = u.pathname.split('/').filter(Boolean);
      if (!segs.length) return false;
      var byId = segs[0] === 'profile.php' && /^\d+$/.test(u.searchParams.get('id') || '');
      if (segs[0] === 'profile.php' && !byId) return false;
      if (!byId && /^(login|login\.php|home\.php|sharer|sharer\.php|share|dialog|plugins|tr|recover|help|policies)$/i.test(segs[0])) return false;
    }
    return true;
  }

  function send(data, done, fail) {
    fetch('/api/intake', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (res) { if (!res.ok) throw new Error(res.j.error || 'Something went wrong.'); done(); })
      .catch(function (err) { fail(err.message + (mail ? ' You can also email ' + mail + '.' : '')); });
  }

  function formData(form) { var d = {}; new FormData(form).forEach(function (v, k) { d[k] = v; }); return d; }

  // Hero quick form: name, business, one contact field (phone or email), trade
  var qf = document.getElementById('quickForm');
  if (qf) {
    var qMsg = qf.querySelector('.form-msg'), qBtn = qf.querySelector('button[type="submit"]'), qDone = document.querySelector('.quick-done');
    qf.addEventListener('submit', function (e) {
      e.preventDefault();
      qMsg.textContent = ''; qMsg.className = 'form-msg';
      var d = formData(qf), c = String(d.contact || '').trim();
      if (EMAIL_RE.test(c)) d.email = c; else d.phone = c;
      delete d.contact;
      d.source = baseSource + ' | hero';
      if (!d.name || !d.business) { qMsg.textContent = 'Please add your name and business name.'; qMsg.className = 'form-msg err'; return; }
      if (!d.email && String(d.phone || '').replace(/\D/g, '').length < 7) { qMsg.textContent = 'Please add a phone number or a valid email.'; qMsg.className = 'form-msg err'; return; }
      if (!linkOk(d.link)) { qMsg.textContent = LINK_MSG; qMsg.className = 'form-msg err'; return; }
      qBtn.disabled = true; qBtn.textContent = 'Checking your link...';
      send(d, function () { qf.hidden = true; qDone.hidden = false; }, function (m) {
        qMsg.textContent = m; qMsg.className = 'form-msg err'; qBtn.disabled = false; qBtn.textContent = 'Send me my free mockup';
      });
    });
  }

  // Full form at the bottom
  var form = document.getElementById('intakeForm');
  if (!form) return;
  var msg = document.getElementById('formMsg'), btn = document.getElementById('submitBtn'), done = document.getElementById('success');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    msg.textContent = ''; msg.className = 'form-msg';
    var d = formData(form);
    var emailOk = EMAIL_RE.test(String(d.email || '').trim());
    var phoneOk = String(d.phone || '').replace(/\D/g, '').length >= 7;
    if (!d.name || !d.business) { msg.textContent = 'Please add your name and business name.'; msg.className = 'form-msg err'; return; }
    if (!emailOk && !phoneOk) { msg.textContent = 'Please add a phone number or a valid email.'; msg.className = 'form-msg err'; return; }
    if (!linkOk(d.link)) { msg.textContent = LINK_MSG; msg.className = 'form-msg err'; return; }
    btn.disabled = true; btn.textContent = 'Checking your link...';
    send(d, function () {
      form.hidden = true; done.hidden = false;
      done.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, function (m) {
      msg.textContent = m; msg.className = 'form-msg err'; btn.disabled = false; btn.textContent = 'Request my free mockup';
    });
  });
})();
