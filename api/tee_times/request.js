import { createHash, randomBytes } from 'node:crypto';
import {
  createUserSupabaseClient,
  getBearerToken,
} from '../_lib/supabase.js';

// Parses "8:00 AM" + "2024-06-15" into an ISO timestamp string.
function parseTimeToTimestamp(timeStr, dateStr) {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && h < 12) h += 12;
  if (ampm === 'AM' && h === 12) h = 0;
  const iso = `${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00.000Z`;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// POST /api/tee_times/request
// Authorization: Bearer <Supabase access token>
// Body: {
//   gameId,
//   requestedTime: "8:00 AM",
//   toProShopName,
//   toProShopEmail
// }
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = getBearerToken(req);

  if (!accessToken) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  const {
    gameId,
    requestedTime,
    toProShopName,
    toProShopEmail,
  } = req.body || {};

  if (!gameId || !requestedTime || typeof requestedTime !== 'string' || !toProShopEmail) {
    return res.status(400).json({
      error: 'Missing required fields: gameId, requestedTime, toProShopEmail',
    });
  }

  const supabase = createUserSupabaseClient(accessToken);

  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    return res.status(401).json({ error: 'Invalid access token' });
  }

  const { data: game, error: gameError } = await supabase
    .from('games')
    .select('scheduled_date')
    .eq('id', gameId)
    .single();

  if (gameError || !game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  const requestedTimestamp = parseTimeToTimestamp(requestedTime, game.scheduled_date);
  if (!requestedTimestamp) {
    return res.status(400).json({ error: 'Invalid time format. Use e.g. "8:00 AM"' });
  }

  const rawResponseToken = randomBytes(32).toString('hex');
  const responseTokenHash = createHash('sha256')
    .update(rawResponseToken)
    .digest('hex');

  const expiresAt = new Date(
    Date.now() + 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data, error } = await supabase
    .from('tee_time_requests')
    .insert({
      game_id: gameId,
      requested_time: requestedTimestamp,
      to_pro_shop_name: toProShopName || null,
      to_pro_shop_email: toProShopEmail,
      status: 'pending',
      response: null,
      expires_at: expiresAt,
      response_token_hash: responseTokenHash,
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({
      error: 'Unable to create tee-time request',
      details: error.message,
    });
  }

  const baseUrl = process.env.PUBLIC_APP_URL || 'https://linksinvite.com';
  return res.status(201).json({
    data,
    responseUrl: `${baseUrl}/respond/${rawResponseToken}`,
  });
}