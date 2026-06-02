import { createUserSupabaseClient, getBearerToken } from '../_lib/supabase.js';

// GET  /api/games?groupId=<uuid>   — list games for a group
// POST /api/games                  — create a game
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  const supabase = createUserSupabaseClient(token);
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  if (req.method === 'GET') {
    const { groupId } = req.query;
    if (!groupId) return res.status(400).json({ error: 'groupId is required' });

    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('group_id', groupId)
      .neq('is_active', false)
      .order('scheduled_date', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === 'POST') {
    const { group_id, location_id, description, rules, max_players,
            pairing_method, assign_players, recurring, recurrence,
            day_of_week, first_tee_time, scheduled_date } = req.body || {};

    if (!group_id) return res.status(400).json({ error: 'group_id is required' });

    const { data, error } = await supabase
      .from('games')
      .insert({
        group_id, location_id, description, rules, max_players,
        pairing_method, assign_players, recurring, recurrence,
        day_of_week, first_tee_time, scheduled_date, is_active: true,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json({ data });
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(405).json({ error: 'Method not allowed' });
}
