import { createUserSupabaseClient, getBearerToken } from '../_lib/supabase.js';

// GET   /api/games/:id
// PATCH /api/games/:id
// DELETE /api/games/:id  (soft-delete via is_active=false)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  const supabase = createUserSupabaseClient(token);
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id is required' });

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('games').select('*').eq('id', id).single();
    if (error) return res.status(404).json({ error: 'Game not found' });
    return res.status(200).json({ data });
  }

  if (req.method === 'PATCH') {
    const allowed = ['location_id','description','rules','max_players','pairing_method',
                     'assign_players','recurring','recurrence','day_of_week','first_tee_time','scheduled_date'];
    const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)));
    const { data, error } = await supabase.from('games').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('games').update({ is_active: false }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE, OPTIONS');
  return res.status(405).json({ error: 'Method not allowed' });
}
