import { createHash, randomBytes } from 'node:crypto';
import {
  getAdminSupabaseClient,
  getBearerToken,
} from '../_lib/supabase.js';

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
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

async function sendEmail({ from, to, subject, html, text }) {
  const provider = (process.env.EMAIL_PROVIDER || '').toLowerCase();

  if (provider === 'resend' || (!provider && process.env.RESEND_API_KEY)) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${requireEnv('RESEND_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html, text }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.message || payload.error || 'Resend send failed');
    return payload.id || null;
  }

  if (provider === 'postmark' || (!provider && process.env.POSTMARK_SERVER_TOKEN)) {
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
    if (!response.ok) throw new Error(payload.Message || payload.ErrorCode || 'Postmark send failed');
    return payload.MessageID || null;
  }

  throw new Error('Set EMAIL_PROVIDER to resend or postmark and add the provider API key');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = getBearerToken(req);
  if (!accessToken) return res.status(401).json({ error: 'Missing bearer token' });

  const { gameId, requestedTime, toProShopName, toProShopEmail } = req.body || {};

  if (!gameId || !toProShopEmail) {
    return res.status(400).json({ error: 'gameId and toProShopEmail are required' });
  }

  const adminSupabase = getAdminSupabaseClient();

  const { data: authData, error: authError } = await adminSupabase.auth.getUser(accessToken);
  if (authError || !authData.user) return res.status(401).json({ error: 'Invalid access token' });

  const { data: game, error: gameError } = await adminSupabase
    .from('games')
    .select('id, group_id, scheduled_date, max_players')
    .eq('id', gameId)
    .maybeSingle();

  if (gameError) return res.status(500).json({ error: 'Unable to load game' });
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const { data: membership } = await adminSupabase
    .from('group_memberships')
    .select('role')
    .eq('group_id', game.group_id)
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (!membership || !['superadmin', 'admin'].includes(membership.role)) {
    return res.status(403).json({ error: 'Only group admins can send tee-time requests' });
  }

  const rawToken = randomBytes(32).toString('hex');
  const responseTokenHash = hashToken(rawToken);
  const respondUrl = `${getPublicAppUrl(req)}/respond/${game.id}`;
  const foursomes = Math.ceil((game.max_players || 16) / 4);

  const { data: record, error: insertError } = await adminSupabase
    .from('tee_time_requests')
    .insert({
      game_id: gameId,
      to_pro_shop_name: toProShopName || '',
      to_pro_shop_email: toProShopEmail,
      requested_time: requestedTime || null,
      response_token_hash: responseTokenHash,
      status: 'pending',
    })
    .select()
    .single();

  if (insertError) {
    return res.status(500).json({ error: 'Unable to create tee-time request', details: insertError.message });
  }

  const subject = `Tee Time Request — ${toProShopName || 'Your Course'}`;
  const text = [
    `Hi ${toProShopName || 'Pro Shop'},`,
    '',
    `I'm reaching out to reserve tee times for our golf group.`,
    '',
    'Game details:',
    `  Date: ${game.scheduled_date || ''}`,
    `  Players: ${game.max_players} (${foursomes} foursomes)`,
    `  Requested times: ${requestedTime || ''}`,
    '',
    'Please confirm or suggest alternates:',
    `  → ${respondUrl}`,
    '',
    'Thank you.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827">
      <p>Hi ${escapeHtml(toProShopName || 'Pro Shop')},</p>
      <p>I'm reaching out to reserve tee times for our golf group.</p>
      <p>
        <strong>Game details:</strong><br/>
        Date: ${escapeHtml(String(game.scheduled_date || ''))}<br/>
        Players: ${game.max_players} (${foursomes} foursomes)<br/>
        Requested times: ${escapeHtml(requestedTime || '')}
      </p>
      <p>
        Please confirm or suggest alternates:<br/>
        <a href="${escapeHtml(respondUrl)}">${escapeHtml(respondUrl)}</a>
      </p>
    </div>
  `;

  try {
    await sendEmail({
      from: requireEnv('EMAIL_FROM'),
      to: toProShopEmail,
      subject,
      html,
      text,
    });
  } catch (sendError) {
    return res.status(502).json({ error: 'Unable to send email', details: sendError.message });
  }

  return res.status(201).json({ data: record });
}
