import { createUserSupabaseClient, getBearerToken } from '../_lib/supabase.js';

// GET   /api/users/me   — return signed-in user's profile
// PATCH /api/users/me   — update profile fields
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  const supabase = createUserSupabaseClient(token);
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('users').select('*').eq('id', user.id).single();
    if (error) return res.status(404).json({ error: 'Profile not found' });
    return res.status(200).json({ data });
  }

  if (req.method === 'PATCH') {
    const allowed = ['first_name', 'last_name', 'phone', 'handicap', 'ghin'];
    const updates = Object.fromEntries(Object.entries(req.body || {}).filter(([k]) => allowed.includes(k)));
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'No updatable fields provided' });

    const { data, error } = await supabase.from('users').update(updates).eq('id', user.id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  res.setHeader('Allow', 'GET, PATCH, OPTIONS');
  return res.status(405).json({ error: 'Method not allowed' });
}
