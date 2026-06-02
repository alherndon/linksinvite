import { createUserSupabaseClient, getBearerToken } from '../_lib/supabase.js';

// PATCH  /api/locations/:id
// DELETE /api/locations/:id  (soft-delete)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'Missing bearer token' });

  const supabase = createUserSupabaseClient(token);
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  const { id } = req.query;

  if (req.method === 'PATCH') {
    const { name, address, tee_time_contact } = req.body || {};
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (address !== undefined) updates.address = address;
    if (tee_time_contact !== undefined) {
      updates.tee_time_contact = typeof tee_time_contact === 'object'
        ? JSON.stringify(tee_time_contact)
        : tee_time_contact;
    }
    const { data, error } = await supabase.from('locations').update(updates).eq('location_id', id).select().single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ data });
  }

  if (req.method === 'DELETE') {
    const { error } = await supabase.from('locations').update({ is_active: false }).eq('location_id', id);
    if (error) return res.status(500).json({ error: error.message });
    return res.status(204).end();
  }

  res.setHeader('Allow', 'PATCH, DELETE, OPTIONS');
  return res.status(405).json({ error: 'Method not allowed' });
}
