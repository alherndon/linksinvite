import { randomUUID } from 'node:crypto';
import {
  getAdminSupabaseClient,
  getBearerToken,
} from '../_lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.PUBLIC_APP_URL || '*');
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

    // Exact name match only — partial/substring search is intentionally removed
    // to prevent anyone from joining a group by guessing a fragment of its name.
    // Users should find the group via the search action first, then confirm join.
    const { data: exact } = await adminSupabase
      .from('groups')
      .select('id, name, description')
      .ilike('name', joinCode.trim())
      .limit(1);

    const foundGroup = exact?.[0] || null;

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

  // ── SEARCH ──────────────────────────────────────────────────────────────────
  if (action === 'search') {
    const query = (joinCode || '').trim();
    if (!query) return res.status(200).json({ data: { groups: [] } });

    const [{ data: exact }, { data: partial }] = await Promise.all([
      adminSupabase.from('groups').select('id, name, description').ilike('name', query).limit(5),
      adminSupabase.from('groups').select('id, name, description').ilike('name', `%${query}%`).limit(10),
    ]);

    const seen = new Set();
    const all = [...(exact || []), ...(partial || [])].filter((g) => {
      if (seen.has(g.id)) return false;
      seen.add(g.id);
      return true;
    });

    const groupIds = all.map((g) => g.id);
    const memberCounts = {};
    if (groupIds.length > 0) {
      const { data: mems } = await adminSupabase
        .from('group_memberships').select('group_id').in('group_id', groupIds);
      for (const m of mems || []) {
        memberCounts[m.group_id] = (memberCounts[m.group_id] || 0) + 1;
      }
    }

    return res.status(200).json({
      data: {
        groups: all.map((g) => ({
          id: g.id,
          name: g.name,
          description: g.description || '',
          memberCount: memberCounts[g.id] || 0,
        })),
      },
    });
  }

  return res.status(400).json({ error: 'action must be "create", "join", or "search"' });
}
