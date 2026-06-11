import { randomUUID } from 'node:crypto';
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

  const adminSupabase = getAdminSupabaseClient();
  const { data: authData, error: authError } =
    await adminSupabase.auth.getUser(accessToken);

  if (authError || !authData?.user) {
    return res.status(401).json({ error: 'Invalid access token' });
  }

  const userId = authData.user.id;
  const { action, name, description, locationName, locationAddress, joinCode } =
    req.body || {};

  // ── CREATE ────────────────────────────────────────────────────────────────
  if (action === 'create') {
    if (!name?.trim()) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const groupId = randomUUID();
    const { error: groupErr } = await adminSupabase.from('groups').insert({
      id: groupId,
      name: name.trim(),
      description: (description || '').trim(),
    });
    if (groupErr) {
      return res
        .status(500)
        .json({ error: 'Unable to create group', details: groupErr.message });
    }

    await adminSupabase.from('group_memberships').insert({
      group_id: groupId,
      user_id: userId,
      role: 'superadmin',
    });

    const locations = [];
    if (locationName?.trim()) {
      const locationId = randomUUID();
      const { error: locErr } = await adminSupabase.from('locations').insert({
        location_id: locationId,
        group_id: groupId,
        name: locationName.trim(),
        address: (locationAddress || '').trim(),
        tee_time_contact: { name: '', email: '', phone: '' },
        is_active: true,
      });
      if (!locErr) {
        locations.push({
          id: locationId,
          name: locationName.trim(),
          address: (locationAddress || '').trim(),
          teeTimeContact: { name: '', email: '', phone: '' },
        });
      }
    }

    return res.status(201).json({
      data: {
        group: {
          id: groupId,
          name: name.trim(),
          description: (description || '').trim(),
          memberships: [{ userId, role: 'superadmin' }],
          locations,
        },
      },
    });
  }

  // ── JOIN ──────────────────────────────────────────────────────────────────
  if (action === 'join') {
    if (!joinCode?.trim()) {
      return res
        .status(400)
        .json({ error: 'Group name or invite code is required' });
    }

    // Search by exact name first, then partial match
    let foundGroup = null;
    const { data: exact } = await adminSupabase
      .from('groups')
      .select('id, name, description')
      .ilike('name', joinCode.trim())
      .limit(1);

    foundGroup = exact?.[0] || null;

    if (!foundGroup) {
      const { data: partial } = await adminSupabase
        .from('groups')
        .select('id, name, description')
        .ilike('name', `%${joinCode.trim()}%`)
        .limit(1);
      foundGroup = partial?.[0] || null;
    }

    if (!foundGroup) {
      return res
        .status(404)
        .json({ error: 'Group not found. Check the name or invite code.' });
    }

    await adminSupabase.from('group_memberships').upsert(
      { group_id: foundGroup.id, user_id: userId, role: 'player' },
      { onConflict: 'group_id,user_id', ignoreDuplicates: false }
    );

    const [{ data: allMems }, { data: locs }] = await Promise.all([
      adminSupabase
        .from('group_memberships')
        .select('user_id, role')
        .eq('group_id', foundGroup.id),
      adminSupabase
        .from('locations')
        .select('location_id, name, address, tee_time_contact')
        .eq('group_id', foundGroup.id)
        .eq('is_active', true),
    ]);

    return res.status(200).json({
      data: {
        group: {
          id: foundGroup.id,
          name: foundGroup.name,
          description: foundGroup.description || '',
          memberships: (allMems || []).map((m) => ({
            userId: m.user_id,
            role: m.role,
          })),
          locations: (locs || []).map((l) => ({
            id: l.location_id,
            name: l.name || '',
            address: l.address || '',
            teeTimeContact:
              typeof l.tee_time_contact === 'object'
                ? l.tee_time_contact
                : { name: '', email: '', phone: '' },
          })),
        },
      },
    });
  }

  return res.status(400).json({ error: 'action must be "create" or "join"' });
}
