import {
  createUserSupabaseClient,
  getAdminSupabaseClient,
  getBearerToken,
} from '../_lib/supabase.js';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = getBearerToken(req);

  if (!accessToken) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  const userSupabase = createUserSupabaseClient(accessToken);
  const { data: authData, error: authError } =
    await userSupabase.auth.getUser();

  if (authError || !authData.user) {
    return res.status(401).json({ error: 'Invalid access token' });
  }

  const adminSupabase = getAdminSupabaseClient();
  const userId = authData.user.id;
  const action = normalizeText(req.body?.action);

  try {
    if (action === 'create') {
      const name = normalizeText(req.body?.name);
      const description = normalizeText(req.body?.description);
      const locationName = normalizeText(req.body?.locationName);
      const locationAddress = normalizeText(req.body?.locationAddress);

      if (!name) {
        return res.status(400).json({ error: 'Group name is required' });
      }

      const { data: groupData, error: groupError } = await adminSupabase
        .from('groups')
        .insert({
          name,
          description,
          is_active: true,
        })
        .select()
        .single();

      if (groupError) {
        throw groupError;
      }

      if (locationName) {
        const { error: locationError } = await adminSupabase
          .from('locations')
          .insert({
            group_id: groupData.id,
            name: locationName,
            address: locationAddress,
            tee_time_contact: JSON.stringify({ name: '', email: '', phone: '' }),
            is_active: true,
          });

        if (locationError) {
          throw locationError;
        }
      }

      const { error: memberError } = await adminSupabase
        .from('group_memberships')
        .insert({
          group_id: groupData.id,
          user_id: userId,
          role: 'superadmin',
        });

      if (memberError) {
        throw memberError;
      }

      return res.status(201).json({ data: { groupId: groupData.id } });
    }

    if (action === 'join') {
      const joinCode = normalizeText(req.body?.joinCode);

      if (!joinCode) {
        return res.status(400).json({ error: 'Group name or invite code is required' });
      }

      const { data: groupData, error: groupFindError } = await adminSupabase
        .from('groups')
        .select('id')
        .ilike('name', `%${joinCode}%`)
        .eq('is_active', true)
        .limit(1)
        .single();

      if (groupFindError || !groupData) {
        return res.status(404).json({
          error: 'Group not found. Check the name and try again.',
        });
      }

      const { error: memberError } = await adminSupabase
        .from('group_memberships')
        .insert({
          group_id: groupData.id,
          user_id: userId,
          role: 'player',
        });

      if (memberError) {
        throw memberError;
      }

      return res.status(200).json({ data: { groupId: groupData.id } });
    }

    return res.status(400).json({ error: 'Action must be create or join' });
  } catch (error) {
    return res.status(500).json({
      error: 'Unable to update your groups',
      details: error.message,
    });
  }
}
