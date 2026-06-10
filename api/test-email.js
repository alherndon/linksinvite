import { sendEmail } from './_lib/email.js';

// One-shot transport test. Visit:  /api/test-email?to=you@example.com
// Purpose: prove an email actually LANDS before building anything on top of it.
// This is the single highest-value test for diagnosing the original breakage.
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
    // The error message tells you exactly what's wrong: a 401 means a bad API
    // key; a 403 about the "from" address means your sending domain isn't
    // verified yet (see the testing notes).
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}
