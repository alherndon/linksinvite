import { createUserSupabaseClient, getBearerToken } from '../_lib/supabase.js';

// GET  /api/groups   — list groups the signed-in user belongs to
// POST /api/groups   — create a group (caller becomes superadmin)
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
    const { data: mems } = await supabase
      .from('group_memberships')
      .select('group_id')
      .eq('user_id', user.id);

    const groupIds = (mems || []).map(m => m.group_id);
    if (groupIds.length === 0) return res.status(200).json({ data: [] });

    const { data, error } = await supabase
      .from('groups')
      .select('*')
      .in('id', groupIds)
      .eq('is_active', true);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === 'POST') {
    const { name, description } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });

    const { data: group, error: groupErr } = await supabase
      .from('groups')
      .insert({ name, description: description || '', is_active: true })
      .select()
      .single();

    if (groupErr) return res.status(500).json({ error: groupErr.message });

    const { error: memErr } = await supabase
      .from('group_memberships')
      .insert({ group_id: group.id, user_id: user.id, role: 'superadmin' });

    if (memErr) return res.status(500).json({ error: memErr.message });

    return res.status(201).json({ data: group });
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return res.status(405).json({ error: 'Method not allowed' });
}
