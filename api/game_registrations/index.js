import { createUserSupabaseClient, getBearerToken } from '../_lib/supabase.js';

// POST /api/game_registrations
// Body: { gameId, action: "register" | "waitlist" | "unregister" }
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  const supabase = createUserSupabaseClient(token);
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  const { gameId, action } = req.body || {};
  if (!gameId || !['register', 'waitlist', 'unregister'].includes(action)) {
    return res.status(400).json({ error: 'gameId and action (register|waitlist|unregister) are required' });
  }

  if (action === 'unregister') {
    const { error } = await supabase
      .from('game_registrations')
      .delete()
      .eq('game_id', gameId)
      .eq('user_id', user.id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  const status = action === 'waitlist' ? ['waitlisted'] : ['registered'];

  // Calculate waitlist position if needed
  let position = null;
  if (action === 'waitlist') {
    const { data: existing } = await supabase
      .from('game_registrations')
      .select('position')
      .eq('game_id', gameId)
      .eq('status', '{waitlisted}');
    const max = Math.max(0, ...(existing || []).map(r => r.position || 0));
    position = max + 1;
  }

  const { data, error } = await supabase
    .from('game_registrations')
    .upsert({ game_id: gameId, user_id: user.id, status, position })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ data });
}
