import {
  getAdminSupabaseClient,
  getBearerToken,
} from '../_lib/supabase.js';

function formatDbDate(d) {
  if (!d) return '';
  const dt = new Date(d + 'T12:00:00Z');
  return dt.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDbTime(t) {
  if (!t) return '8:00 AM';
  const m = t.match(/(\d+):(\d+)/);
  if (!m) return t;
  const h = parseInt(m[1]);
  const mn = parseInt(m[2]);
  const ap = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(mn).padStart(2, '0')} ${ap}`;
}

function firstValue(v) {
  return Array.isArray(v) ? v[0] : v;
}

function parseTeeTimeContact(raw) {
  if (raw && typeof raw === 'object') return raw;
  try { return JSON.parse(raw || '{}'); } catch { return { name: '', email: '', phone: '' }; }
}

function parseResponse(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
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

  try {
    // 1. Groups this user belongs to
    const { data: myMems, error: myMemErr } = await adminSupabase
      .from('group_memberships')
      .select('group_id, role, groups ( id, name, description )')
      .eq('user_id', userId);

    if (myMemErr) throw new Error('Unable to load your groups');
    if (!myMems || myMems.length === 0) {
      return res.status(200).json({ data: { users: [], groups: [], games: [] } });
    }

    const groupIds = myMems.map((m) => m.group_id);

    // 2. All memberships in those groups
    const { data: allMems, error: allMemErr } = await adminSupabase
      .from('group_memberships')
      .select('group_id, user_id, role')
      .in('group_id', groupIds);
    if (allMemErr) throw new Error('Unable to load group members');

    // 3. User profiles for all members
    const allUserIds = [...new Set((allMems || []).map((m) => m.user_id))];
    const { data: userRows, error: userErr } = await adminSupabase
      .from('users')
      .select('id, first_name, last_name, email, phone, handicap, ghin')
      .in('id', allUserIds);
    if (userErr) throw new Error('Unable to load user profiles');

    // 4. Locations
    const { data: locationRows, error: locErr } = await adminSupabase
      .from('locations')
      .select('location_id, group_id, name, address, tee_time_contact')
      .in('group_id', groupIds)
      .eq('is_active', true);
    if (locErr) throw new Error('Unable to load locations');

    // 5. Active games
    const { data: gameRows, error: gameErr } = await adminSupabase
      .from('games')
      .select('*')
      .in('group_id', groupIds)
      .eq('is_active', true)
      .order('scheduled_date', { ascending: false });
    if (gameErr) throw new Error('Unable to load games');

    const gameIds = (gameRows || []).map((g) => g.id);

    // 6. Registrations
    let regRows = [];
    if (gameIds.length > 0) {
      const { data: regs, error: regErr } = await adminSupabase
        .from('game_registrations')
        .select('game_id, user_id, status, position')
        .in('game_id', gameIds);
      if (regErr) throw new Error('Unable to load registrations');
      regRows = regs || [];
    }

    // 7. Tee-time requests (table may not exist in all deployments — fail soft)
    let ttrRows = [];
    if (gameIds.length > 0) {
      const { data: ttrs } = await adminSupabase
        .from('tee_time_requests')
        .select('*')
        .in('game_id', gameIds);
      ttrRows = ttrs || [];
    }

    // ── Transform ──────────────────────────────────────────────────────────────

    const users = (userRows || []).map((row) => ({
      id: row.id,
      firstName: row.first_name || '',
      lastName: row.last_name || '',
      email: row.email || '',
      phone: row.phone || '',
      handicap: Number(row.handicap) || 0,
      ghin: row.ghin || '',
    }));

    const memsByGroup = {};
    for (const m of allMems || []) {
      (memsByGroup[m.group_id] = memsByGroup[m.group_id] || []).push({
        userId: m.user_id,
        role: m.role,
      });
    }

    const locsByGroup = {};
    for (const l of locationRows || []) {
      (locsByGroup[l.group_id] = locsByGroup[l.group_id] || []).push({
        id: l.location_id,
        name: l.name || '',
        address: l.address || '',
        lat: 33.5,
        lng: -84.5,
        teeTimeContact: parseTeeTimeContact(l.tee_time_contact),
      });
    }

    const groups = myMems.map((m) => ({
      id: m.group_id,
      name: m.groups?.name || '',
      description: m.groups?.description || '',
      memberships: memsByGroup[m.group_id] || [],
      locations: locsByGroup[m.group_id] || [],
    }));

    const games = (gameRows || []).map((row) => {
      const regsForGame = regRows.filter((r) => r.game_id === row.id);
      const ttrsForGame = ttrRows.filter((t) => t.game_id === row.id);
      return {
        id: row.id,
        groupId: row.group_id,
        locationId: row.location_id,
        day: firstValue(row.day_of_week) || '',
        date: formatDbDate(row.scheduled_date),
        time: formatDbTime(row.first_tee_time),
        description: row.description || '',
        rules: row.rules || '',
        pairingMethod: firstValue(row.pairing_method) || 'balanced',
        assignFoursomes: Boolean(row.assign_players),
        maxPlayers: Number(row.max_players) || 16,
        recurring: Boolean(row.recurring),
        recurrence: row.recurrence || null,
        registrations: regsForGame
          .filter((r) => String(r.status || '').includes('registered'))
          .map((r) => r.user_id),
        waitlist: regsForGame
          .filter((r) => String(r.status || '').includes('waitlisted'))
          .sort((a, b) => (a.position || 0) - (b.position || 0))
          .map((r) => r.user_id),
        teeTimeRequests: ttrsForGame.map((t) => ({
          id: String(t.response_token_hash || t.id || ''),
          sentAt: t.sent_at
            ? new Date(t.sent_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })
            : '',
          requestedTimes: t.requested_time
            ? [
                new Date(t.requested_time).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZone: 'UTC',
                }),
              ]
            : [],
          players: 0,
          toName: t.to_pro_shop_name || '',
          toEmail: t.to_pro_shop_email || '',
          status: t.status || 'pending',
          response: parseResponse(t.response),
        })),
      };
    });

    return res.status(200).json({ data: { users, groups, games } });
  } catch (err) {
    return res
      .status(500)
      .json({ error: err.message || 'Unable to load groups' });
  }
}
