// Self-contained: no local imports, so nothing can fail to bundle.
// One-shot transport test:  /api/test-email?to=you@example.com

const PROVIDER = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase();
const FROM = process.env.EMAIL_FROM || 'LinksInvite <onboarding@resend.dev>';

async function sendEmail({ to, subject, html }) {
  if (PROVIDER === 'postmark') {
    const token = process.env.POSTMARK_SERVER_TOKEN;
    if (!token) throw new Error('POSTMARK_SERVER_TOKEN is not set');
    const res = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': token,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        From: FROM,
        To: Array.isArray(to) ? to.join(',') : to,
        Subject: subject,
        HtmlBody: html,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`Postmark ${res.status}: ${JSON.stringify(data)}`);
    return data;
  }

  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

export default async function handler(req, res) {
  const to = req.query.to;
  if (!to) {
    return res.status(400).json({ error: 'Add ?to=you@example.com to the URL' });
  }
  try {
    const result = await sendEmail({
      to,
      subject: 'LinksInvite test email',
      html: '<p>If you can read this, your email transport works.</p>',
    });
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
