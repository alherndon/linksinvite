import { createHash, randomBytes } from 'node:crypto';
import {
  createUserSupabaseClient,
  getBearerToken,
} from '../_lib/supabase.js';

// POST /api/tee_times/request
// Authorization: Bearer <Supabase access token>
// Body: {
//   gameId,
//   requestedTimes: ["8:00 AM", "8:10 AM"],
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
    requestedTimes,
    toProShopName,
    toProShopEmail,
  } = req.body || {};

  if (
    !gameId ||
    !Array.isArray(requestedTimes) ||
    requestedTimes.length === 0 ||
    !toProShopEmail
  ) {
    return res.status(400).json({
      error: 'Missing required fields: gameId, requestedTimes, toProShopEmail',
    });
  }

  const supabase = createUserSupabaseClient(accessToken);

  const { data: authData, error: authError } =
    await supabase.auth.getUser();

  if (authError || !authData.user) {
    return res.status(401).json({ error: 'Invalid access token' });
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
      requested_time: requestedTimes,
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

  return res.status(201).json({
    data,
    responseUrl: `https://linksinvite.com/respond/${rawResponseToken}`,
  });
}