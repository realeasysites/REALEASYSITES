const nodemailer = require('nodemailer');

let transporter = null;

function getTransport() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT || 465),
    secure: String(SMTP_SECURE || 'true') === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

const esc = (s) =>
  String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const row = (k, v) =>
  v ? `<tr><td style="padding:4px 12px 4px 0;color:#667;vertical-align:top">${k}</td><td style="padding:4px 0"><b>${esc(v)}</b></td></tr>` : '';

async function sendLeadAlert(lead) {
  const t = getTransport();
  const to = process.env.NOTIFY_EMAIL;
  if (!t || !to) return { skipped: true };
  const site = (process.env.SITE_URL || '').replace(/\/$/, '');
  const link = site ? `<p><a href="${site}/admin">View in dashboard</a></p>` : '';
  await t.sendMail({
    from: `"Real Easy Sites" <${process.env.SMTP_USER}>`,
    to,
    replyTo: lead.email || undefined,
    subject: `New mockup request: ${lead.business || lead.name}${lead.plan ? ' (' + lead.plan + ')' : ''}`,
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#14181f">
      <h2 style="margin:0 0 12px">New mockup request</h2>
      <table>${row('Name', lead.name)}${row('Business', lead.business)}${row('Phone', lead.phone)}${row('Email', lead.email || 'not given, call or text')}
      ${row('Trade', lead.trade)}${row('Service area', lead.area)}${row('Facebook page', lead.facebook)}${row('Website', lead.website)}${row('Link check', lead.link_check === 'verified' ? 'Opened fine' : 'Could not auto-verify, open it to check')}${row('Plan interest', lead.plan)}${row('Source', lead.source)}</table>
      ${lead.message ? `<p style="margin-top:14px"><b>What they want customers to find:</b><br>${esc(lead.message).replace(/\n/g, '<br>')}</p>` : ''}
      ${link}<p style="color:#667;font-size:13px">${lead.email ? 'Reply goes straight to the customer.' : 'No email given, so reach out by phone.'}</p></div>`,
  });
  return { sent: true };
}

async function sendAutoReply(lead) {
  const t = getTransport();
  if (!t || !lead.email) return { skipped: true };
  const first = String(lead.name || '').split(' ')[0] || 'there';
  await t.sendMail({
    from: `"Real Easy Sites" <${process.env.SMTP_USER}>`,
    to: lead.email,
    subject: 'Got your mockup request',
    html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#14181f;max-width:520px">
      <p>Hi ${esc(first)},</p>
      <p>Thanks for reaching out. I got your request${lead.business ? ' for <b>' + esc(lead.business) + '</b>' : ''} and will follow up personally, usually within one business day, with next steps for your free mockup.</p>
      <p>If it is urgent, just reply to this email.</p>
      <p>Kivvy<br>Real Easy Sites</p></div>`,
  });
  return { sent: true };
}

module.exports = { sendLeadAlert, sendAutoReply };
