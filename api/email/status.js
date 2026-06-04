import { getAdminSupabaseClient } from '../_lib/supabase.js';

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

function isAuthorized(req) {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;

  if (!secret) {
    return true;
  }

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

  if (!isAuthorized(req)) {
    return res.status(401).json({ error: 'Invalid webhook secret' });
  }

  const payload = req.body || {};
  const event = normalizeWebhook(payload);

  if (!event.providerMessageId) {
    return res.status(400).json({
      error: 'Webhook payload did not include a provider message id',
    });
  }

  const supabase = getAdminSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('notification_events')
    .update({
      provider: event.provider,
      status: event.status,
      response_payload: {
        providerEventType: event.eventType,
        providerOccurredAt: event.occurredAt,
        webhook: payload,
      },
      updated_at: now,
    })
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
