// Minimal email sender. Uses plain fetch against the provider's REST API, so
// there's NO npm dependency to install. This directly avoids what most likely
// broke the original app: .env configured Resend/Postmark, but neither package
// was in package.json, so any `import { Resend }` would crash the function.

const PROVIDER = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase();
const FROM = process.env.EMAIL_FROM || 'LinksInvite <onboarding@resend.dev>';

export async function sendEmail({ to, subject, html }) {
  if (PROVIDER === 'postmark') return sendViaPostmark({ to, subject, html });
  return sendViaResend({ to, subject, html });
}

async function sendViaResend({ to, subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
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

async function sendViaPostmark({ to, subject, html }) {
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
