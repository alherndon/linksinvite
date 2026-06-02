import { createHash } from 'node:crypto';
import { getAdminSupabaseClient } from '../_lib/supabase.js';

const RESPONSE_TYPES = new Set(['confirmed', 'alternates']);

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

function getToken(req) {
  return req.method === 'GET' ? req.query.token : req.body?.token;
}

function isExpired(expiresAt) {
  return new Date(expiresAt).getTime() <= Date.now();
}

function publicRequest(request) {
  return {
    id: request.response_id,
    requestedTimes: request.requested_time,
    toProShopName: request.to_pro_shop_name,
    status: request.status,
    expiresAt: request.expires_at,
    respondedAt: request.responded_at,
  };
}

async function findRequest(supabase, token) {
  return supabase
    .from('tee_time_requests')
    .select(
      'response_id, requested_time, to_pro_shop_name, status, expires_at, responded_at'
    )
    .eq('response_token_hash', hashToken(token))
    .maybeSingle();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getToken(req);

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing response token' });
  }

  const supabase = getAdminSupabaseClient();
  const { data: request, error: findError } = await findRequest(supabase, token);

  if (findError) {
    return res.status(500).json({ error: 'Unable to load tee-time request' });
  }

  if (!request) {
    return res.status(404).json({ error: 'Invalid response link' });
  }

  if (isExpired(request.expires_at)) {
    return res.status(410).json({ error: 'This response link has expired' });
  }

  if (req.method === 'GET') {
    return res.status(200).json({ data: publicRequest(request) });
  }

  if (request.status === 'responded') {
    return res.status(409).json({ error: 'A response has already been submitted' });
  }

  const { type, confirmedTime, alternateTimes, note } = req.body || {};

  if (!RESPONSE_TYPES.has(type)) {
    return res.status(400).json({
      error: 'Response type must be confirmed or alternates',
    });
  }

  if (type === 'confirmed' && !confirmedTime) {
    return res.status(400).json({ error: 'Missing confirmedTime' });
  }

  if (
    type === 'alternates' &&
    (!Array.isArray(alternateTimes) || alternateTimes.length === 0)
  ) {
    return res.status(400).json({ error: 'Missing alternateTimes' });
  }

  const respondedAt = new Date().toISOString();
  const response = {
    type,
    confirmedTime: type === 'confirmed' ? confirmedTime : null,
    alternateTimes: type === 'alternates' ? alternateTimes : null,
    note: note || null,
    respondedAt,
  };

  const { data, error: updateError } = await supabase
    .from('tee_time_requests')
    .update({
      status: 'responded',
      response,
      responded_at: respondedAt,
    })
    .eq('response_id', request.response_id)
    .eq('status', request.status)
    .select(
      'response_id, requested_time, to_pro_shop_name, status, expires_at, responded_at'
    )
    .single();

  if (updateError) {
    return res.status(500).json({ error: 'Unable to save tee-time response' });
  }

  return res.status(200).json({ data: publicRequest(data) });
}
