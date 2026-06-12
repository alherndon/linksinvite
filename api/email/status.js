import crypto from 'node:crypto';
import { getAdminSupabaseClient } from '../_lib/supabase.js';

// Resend (Svix) signatures are computed over the raw, unparsed request body.
// Disable Vercel's automatic body parsing so we read the exact signed bytes.
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

// Verify a Resend/Svix webhook signature.
//   header  svix-signature = space-delimited list of "v1,<base64-sig>"
//   signed  `${svix-id}.${svix-timestamp}.${rawBody}`
//   key     base64-decoded portion of the whsec_ signing secret
function verifySvixSignature(req, rawBody, secret) {
  const id = req.headers['svix-id'];
  const timestamp = req.headers['svix-timestamp'];
  const sigHeader = req.headers['svix-signature'];
  if (!id || !timestamp || !sigHeader) return false;

  // Replay protection: reject timestamps more than 5 minutes from now.
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const signedContent = `${id}.${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secretBytes).update(signedContent).digest('base64');
  const expectedBuf = Buffer.from(expected);

  return sigHeader.split(' ').some((part) => {
    const sig = part.includes(',') ? part.split(',')[1] : part;
    const sigBuf = Buffer.from(sig || '');
    return sigBuf.length === expectedBuf.length && crypto.timingSafeEqual(sigBuf, expectedBuf);
  });
}

const RESEND_STATUS = {
  'email.sent': 'sent',
  'email.delivered': 'delivered',
  'email.delivery_delayed': 'delayed',
  'email.bounced': 'bounced',
  'email.failed': 'failed',
  'email.complained': 'complained',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.suppressed': 'suppressed',
};

const POSTMARK_STATUS = {
  Delivery: 'delivered',
  Bounce: 'bounced',
  Open: 'opened',
  Click: 'clicked',
  SpamComplaint: 'complained',
  SubscriptionChange: 'subscription_changed',
};

function isAuthorized(req, rawBody) {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;

  // Fail closed: if no secret is configured, reject rather than accept
  // unauthenticated writes. For Resend, set EMAIL_WEBHOOK_SECRET to the
  // whsec_ signing secret shown when you create the webhook endpoint.
  if (!secret) {
    console.warn('EMAIL_WEBHOOK_SECRET is not set — rejecting webhook. Configure it to enable status updates.');
    return false;
  }

  // Resend signs with Svix-style signatures.
  if (req.headers['svix-signature']) {
    return verifySvixSignature(req, rawBody, secret);
  }

  // Fallback shared-secret scheme (e.g. Postmark or manual testing).
  const authorization = req.headers.authorization || '';
  const bearerToken = authorization.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;

  return (
    bearerToken === secret ||
    req.headers['x-linksinvite-webhook-secret'] === secret
  );
}

function normalizeResend(payload) {
  const type = payload.type || '';
  const emailId = payload.data?.email_id || payload.data?.id || null;

  return {
    provider: 'resend',
    providerMessageId: emailId,
    status: RESEND_STATUS[type] || type.replace(/^email\./, '') || 'updated',
    eventType: type || null,
    occurredAt: payload.created_at || payload.data?.created_at || null,
  };
}

function normalizePostmark(payload) {
  const recordType = payload.RecordType || payload.recordType || payload.Type || '';
  const messageId = payload.MessageID || payload.MessageId || payload.MessageIDHash || null;

  return {
    provider: 'postmark',
    providerMessageId: messageId,
    status: POSTMARK_STATUS[recordType] || String(recordType).toLowerCase() || 'updated',
    eventType: recordType || null,
    occurredAt: payload.ReceivedAt || payload.DeliveredAt || payload.BouncedAt || null,
  };
}

function normalizeWebhook(payload) {
  if (payload.type && String(payload.type).startsWith('email.')) {
    return normalizeResend(payload);
  }

  if (payload.RecordType || payload.MessageID || payload.MessageId) {
    return normalizePostmark(payload);
  }

  return {
    provider: payload.provider || null,
    providerMessageId:
      payload.provider_message_id ||
      payload.message_id ||
      payload.email_id ||
      payload.id ||
      null,
    status: payload.status || payload.event || 'updated',
    eventType: payload.event || payload.type || null,
    occurredAt: payload.created_at || payload.timestamp || null,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-LinksInvite-Webhook-Secret'
  );

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let rawBody = '';
  try {
    rawBody = await readRawBody(req);
  } catch {
    return res.status(400).json({ error: 'Unable to read request body' });
  }

  if (!isAuthorized(req, rawBody)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  let payload = {};
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const event = normalizeWebhook(payload);

  if (!event.providerMessageId) {
    return res.status(400).json({
      error: 'Webhook payload did not include a provider message id',
    });
  }

  const supabase = getAdminSupabaseClient();
  const { data, error } = await supabase
    .from('notification_events')
    .update({ delivery_status: event.status })
    .eq('provider_message_id', event.providerMessageId)
    .select()
    .maybeSingle();

  if (error) {
    return res.status(500).json({
      error: 'Unable to update notification status',
      details: error.message,
    });
  }

  if (!data) {
    return res.status(202).json({
      received: true,
      matched: false,
      providerMessageId: event.providerMessageId,
    });
  }

  return res.status(200).json({
    received: true,
    matched: true,
    data,
  });
}
