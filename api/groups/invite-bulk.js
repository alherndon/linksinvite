import {
  getAdminSupabaseClient,
  getBearerToken,
} from '../_lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = getBearerToken(req);
  if (!accessToken) return res.status(401).json({ error: 'Missing bearer token' });

  const { groupId, emails } = req.body || {};
  if (!groupId || !Array.isArray(emails) || emails.length === 0) {
    return res.status(400).json({ error: 'Missing groupId or emails array' });
  }

  const adminSupabase = getAdminSupabaseClient();
  const { data: authData, error: authError } =
    await adminSupabase.auth.getUser(accessToken);
  if (authError || !authData?.user) {
    return res.status(401).json({ error: 'Invalid access token' });
  }

  const { data: membership } = await adminSupabase
    .from('group_memberships')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (!membership || !['superadmin', 'admin'].includes(membership.role)) {
    return res.status(403).json({ error: 'Must be group admin to import members' });
  }
  const results = { added: [], alreadyMember: [], notFound: [] };

  const validEmails = emails
    .map((e) => String(e).trim().toLowerCase())
    .filter((e) => e.includes('@') && e.includes('.'));

  for (const email of validEmails) {
    const { data: user } = await adminSupabase
      .from('users')
      .select('id, first_name, last_name, email')
      .eq('email', email)
      .maybeSingle();

    if (!user) {
      results.notFound.push(email);
      continue;
    }

    const { data: existing } = await adminSupabase
      .from('group_memberships')
      .select('role')
      .eq('group_id', groupId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      results.alreadyMember.push({
        userId: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: existing.role,
      });
      continue;
    }

    const { error: insertError } = await adminSupabase
      .from('group_memberships')
      .insert({ group_id: groupId, user_id: user.id, role: 'player' });

    if (!insertError) {
      results.added.push({
        userId: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
      });
    }
  }

  return res.status(200).json(results);
}
