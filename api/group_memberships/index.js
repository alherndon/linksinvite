import { createUserSupabaseClient, getBearerToken } from '../_lib/supabase.js';

// GET    /api/group_memberships?groupId=<uuid>   — list members of a group
// POST   /api/group_memberships                  — add/update a member (superadmin only)
// DELETE /api/group_memberships?groupId=&userId= — remove a member (superadmin only)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
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
      .from('group_memberships')
      .select('user_id, role')
      .eq('group_id', groupId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === 'POST') {
    const { groupId, userId, role } = req.body || {};
    if (!groupId || !userId || !role) return res.status(400).json({ error: 'groupId, userId, and role are required' });

    // Check caller has superadmin rights
    const { data: callerMem } = await supabase
      .from('group_memberships').select('role').eq('group_id', groupId).eq('user_id', user.id).single();
    if (callerMem?.role !== 'superadmin') return res.status(403).json({ error: 'Superadmin access required' });

    const { data, error } = await supabase
      .from('group_memberships')
      .upsert({ group_id: groupId, user_id: userId, role })
      .select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === 'DELETE') {
    const { groupId, userId } = req.query;
    if (!groupId || !userId) return res.status(400).json({ error: 'groupId and userId are required' });

    const { data: callerMem } = await supabase
      .from('group_memberships').select('role').eq('group_id', groupId).eq('user_id', user.id).single();
    if (callerMem?.role !== 'superadmin') return res.status(403).json({ error: 'Superadmin access required' });

    const { error } = await supabase
      .from('group_memberships').delete().eq('group_id', groupId).eq('user_id', userId);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.setHeader('Allow', 'GET, POST, DELETE, OPTIONS');
  return res.status(405).json({ error: 'Method not allowed' });
}
