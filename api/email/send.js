import { createHash, randomBytes } from 'node:crypto';
import {
  getAdminSupabaseClient,
  getBearerToken,
} from '../_lib/supabase.js';

const DEFAULT_ACTIONS = ['yes', 'no', 'waitlist'];

function requireEnv(name) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function getPublicAppUrl(req) {
  if (process.env.PUBLIC_APP_URL) {
    return process.env.PUBLIC_APP_URL.replace(/\/$/, '');
  }

  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';

  return `${proto}://${host}`;
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const ACTION_LABELS = {
  yes: "Yes, I'm in",
  no: "I'm out",
  waitlist: 'Waitlist me',
};

const ACTION_STYLES = {
  yes: 'background:#1e6b2f;color:#ffffff',
  no: 'background:#6b7280;color:#ffffff',
  waitlist: 'background:#f3f4f6;color:#374151;border:1px solid #d1d5db',
};

function buildResponseLinks(baseUrl, token, actions = DEFAULT_ACTIONS) {
  return actions.map((action) => {
    const url = new URL('/api/email/respond', baseUrl);
    url.searchParams.set('token', token);
    url.searchParams.set('action', action);

    return {
      action,
      url: url.toString(),
    };
  });
}

function buildHtmlEmail({ body, responseLinks }) {
  const buttonMarkup = responseLinks.length > 0
    ? `<p style="margin:20px 0 0;">` +
      responseLinks
        .map(({ action, url }) => {
          const label = ACTION_LABELS[action] || action.toUpperCase();
          const style = ACTION_STYLES[action] || 'background:#1e6b2f;color:#ffffff';
          return `<a href="${escapeHtml(url)}" style="display:inline-block;margin:0 8px 8px 0;padding:12px 24px;border-radius:8px;font-family:Arial,sans-serif;font-size:15px;font-weight:600;text-decoration:none;${style}">${escapeHtml(label)}</a>`;
        })
        .join('')
      + `</p>`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111827">
      <p>${escapeHtml(body).replace(/\n/g, '<br />')}</p>
      ${buttonMarkup}
    </div>
  `;
}

async function sendWithResend({ from, to, subject, html, text }) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${requireEnv('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html,
      text,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || payload.error || 'Resend send failed');
  }

  return payload.id || null;
}

async function sendWithPostmark({ from, to, subject, html, text }) {
  const response = await fetch('https://api.postmarkapp.com/email', {
    method: 'POST',
    headers: {
      'X-Postmark-Server-Token': requireEnv('POSTMARK_SERVER_TOKEN'),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      From: from,
      To: to,
      Subject: subject,
      HtmlBody: html,
      TextBody: text,
      MessageStream: process.env.POSTMARK_MESSAGE_STREAM || 'outbound',
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.Message || payload.ErrorCode || 'Postmark send failed');
  }

  return payload.MessageID || null;
}

async function sendEmail(email) {
  const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();

  if (provider === 'resend') {
    return sendWithResend(email);
  }

  if (provider === 'postmark') {
    return sendWithPostmark(email);
  }

  if (process.env.RESEND_API_KEY) {
    return sendWithResend(email);
  }

  if (process.env.POSTMARK_SERVER_TOKEN) {
    return sendWithPostmark(email);
  }

  throw new Error('Set EMAIL_PROVIDER to resend or postmark and add the provider API key');
}

async function assertGroupMember(supabase, groupId, userId) {
  const { data, error } = await supabase
    .from('group_memberships')
    .select('group_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error('Unable to verify group membership');
  }

  if (!data) {
    const err = new Error('You do not have access to this group');
    err.statusCode = 403;
    throw err;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.PUBLIC_APP_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const accessToken = getBearerToken(req);

    if (!accessToken) {
      return res.status(401).json({ error: 'Missing bearer token' });
    }

    const {
      groupId,
      gameId = null,
      recipientUserId = null,
      toEmail,
      eventType = 'game_invite',
      subject = 'LinksInvite invitation',
      body = 'Can you play?',
      actions = DEFAULT_ACTIONS,
    } = req.body || {};

    if (!groupId || !toEmail) {
      return res.status(400).json({
        error: 'Missing required fields: groupId, toEmail',
      });
    }

    if (!Array.isArray(actions)) {
      return res.status(400).json({ error: 'actions must be an array' });
    }

    // Validate the token with the service-role client (getUser(token)).
    // A user-scoped client + getUser() with no argument has no session and
    // always 401s, and the membership check below must not depend on RLS.
    const adminSupabase = getAdminSupabaseClient();
    const { data: authData, error: authError } =
      await adminSupabase.auth.getUser(accessToken);

    if (authError || !authData?.user) {
      return res.status(401).json({ error: 'Invalid access token' });
    }

    await assertGroupMember(adminSupabase, groupId, authData.user.id);

    const rawToken = randomBytes(32).toString('hex');
    const responseTokenHash = hashToken(rawToken);
    const fromEmail = requireEnv('EMAIL_FROM');
    const baseUrl = getPublicAppUrl(req);
    const responseLinks = buildResponseLinks(baseUrl, rawToken, actions);
    const html = buildHtmlEmail({ body, responseLinks });
    const text = [
      body,
      '',
      ...responseLinks.map(({ action, url }) => `${ACTION_LABELS[action] || action.toUpperCase()}: ${url}`),
    ].join('\n');

    const { data: event, error: insertError } = await adminSupabase
      .from('notification_events')
      .insert({
        group_id: groupId,
        game_id: gameId,
        user_id: recipientUserId,
        event_type: eventType,
        response_token_hash: responseTokenHash,
      })
      .select()
      .single();

    if (insertError) {
      return res.status(500).json({
        error: 'Unable to create notification event',
        details: insertError.message,
      });
    }

    try {
      const providerMessageId = await sendEmail({
        from: fromEmail,
        to: toEmail,
        subject,
        html,
        text,
      });

      const sentAt = new Date().toISOString();
      const update = { sent_at: sentAt };
      if (providerMessageId) update.provider_message_id = providerMessageId;
      const { data: updatedEvent, error: updateError } = await adminSupabase
        .from('notification_events')
        .update(update)
        .eq('id', event.id)
        .select()
        .single();

      if (updateError) {
        return res.status(500).json({
          error: 'Email sent, but notification event could not be updated',
          details: updateError.message,
        });
      }

      return res.status(201).json({
        data: updatedEvent,
        responseLinks,
      });
    } catch (sendError) {
      return res.status(502).json({
        error: 'Unable to send email',
        details: sendError.message,
      });
    }
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || 'Unable to send email',
    });
  }
}
