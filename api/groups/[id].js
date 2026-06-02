import { createUserSupabaseClient, getBearerToken } from '../_lib/supabase.js';

// GET   /api/groups/:id
// PATCH /api/groups/:id   — admin/superadmin only
// DELETE /api/groups/:id  — superadmin only (soft-delete)
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
    const { data, error } = await supabase.from('groups').select('*').eq('id', id).single();
    if (error) return res.status(404).json({ error: 'Group not found' });
    return res.status(200).json({ data });
  }

  // Verify caller has admin rights before mutating
  const { data: mem } = await supabase
    .from('group_memberships')
    .select('role')
    .eq('group_id', id)
    .eq('user_id', user.id)
    .single();

  const role = mem?.role;

  if (req.method === 'PATCH') {
    if (!['superadmin', 'admin'].includes(role)) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const { name, description } = req.body || {};
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    const { data, error } = await supabase.from('groups').update(updates).eq('id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === 'DELETE') {
    if (role !== 'superadmin') return res.status(403).json({ error: 'Superadmin access required' });
    const { error } = await supabase.from('groups').update({ is_active: false }).eq('id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.setHeader('Allow', 'GET, PATCH, DELETE, OPTIONS');
  return res.status(405).json({ error: 'Method not allowed' });
}
