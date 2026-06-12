import { getAdminSupabaseClient } from '../_lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // The front end passes the game ID as the token (from /respond/<gameId> URL).
  const token = req.method === 'GET' ? req.query.token : req.body?.token;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'Missing token' });
  }

  const supabase = getAdminSupabaseClient();

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('tee_time_requests')
      .select('*')
      .eq('game_id', token)
      .order('sent_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return res.status(500).json({ error: 'Unable to load tee-time request' });
    if (!data) return res.status(404).json({ error: 'Tee-time request not found' });

    return res.status(200).json({
      data: {
        ...data,
        requestedTimes: data.requested_time ? [data.requested_time] : [],
      },
    });
  }

  // POST — pro shop submits their response
  const { type, confirmedTime, alternateTimes, note } = req.body || {};

  const { data: existing, error: findError } = await supabase
    .from('tee_time_requests')
    .select('id, status')
    .eq('game_id', token)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (findError) return res.status(500).json({ error: 'Unable to load tee-time request' });
  if (!existing) return res.status(404).json({ error: 'Tee-time request not found' });

  if (existing.status === 'responded') {
    return res.status(409).json({ error: 'This request has already been responded to' });
  }

  const { data: updated, error: updateError } = await supabase
    .from('tee_time_requests')
    .update({
      status: 'responded',
      response: { type, confirmedTime, alternateTimes, note },
    })
    .eq('id', existing.id)
    .select()
    .single();

  if (updateError) return res.status(500).json({ error: 'Unable to record response', details: updateError.message });

  return res.status(200).json({
    data: {
      ...updated,
      requestedTimes: updated.requested_time ? [updated.requested_time] : [],
    },
  });
}
