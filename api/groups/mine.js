import {
  getAdminSupabaseClient,
  getBearerToken,
} from '../_lib/supabase.js';

function toUser(row, authUser) {
  return {
    id: row?.id || authUser.id,
    firstName: row?.first_name || '',
    lastName: row?.last_name || '',
    email: row?.email || authUser.email || '',
    phone: row?.phone || '',
    handicap: Number(row?.handicap) || 0,
    ghin: row?.ghin || '',
  };
}

function toLocation(row) {
  return {
    id: row.location_id,
    name: row.name || '',
    address: row.address || '',
    lat: 33.5,
    lng: -84.5,
    teeTimeContact: row.tee_time_contact || {},
  };
}

function formatDbDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
}

function formatDbTime(value) {
  if (!value) return '8:00 AM';
  const match = String(value).match(/(\d+):(\d+)/);
  if (!match) return value;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${suffix}`;
}

function toGame(row, registrations, teeTimeRequests) {
  return {
    id: row.id,
    groupId: row.group_id,
    locationId: row.location_id,
    day: Array.isArray(row.day_of_week)
      ? row.day_of_week[0]
      : row.day_of_week || '',
    date: formatDbDate(row.scheduled_date),
    time: formatDbTime(row.first_tee_time),
    description: row.description || '',
    rules: row.rules || '',
    pairingMethod: Array.isArray(row.pairing_method)
      ? row.pairing_method[0]
      : row.pairing_method || 'balanced',
    assignFoursomes: row.assign_players || false,
    maxPlayers: Number(row.max_players) || 16,
    recurring: row.recurring || false,
    recurrence: row.recurrence || null,
    registrations: registrations
      .filter(item => item.game_id === row.id && item.status?.includes('registered'))
      .map(item => item.user_id),
    waitlist: registrations
      .filter(item => item.game_id === row.id && item.status?.includes('waitlisted'))
      .sort((a, b) => (a.position || 0) - (b.position || 0))
      .map(item => item.user_id),
    teeTimeRequests: teeTimeRequests
      .filter(item => item.game_id === row.id)
      .map(item => ({
        id: String(item.response_token_hash || item.response_id),
        sentAt: item.sent_at
          ? new Date(item.sent_at).toLocaleString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })
          : '',
        requestedTimes: item.requested_time
          ? [new Date(item.requested_time).toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              timeZone: 'UTC',
            })]
          : [],
        players: 0,
        toName: item.to_pro_shop_name || '',
        toEmail: item.to_pro_shop_email || '',
        status: item.status || 'pending',
        response: item.response || null,
      })),
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = getBearerToken(req);

  if (!accessToken) {
    return res.status(401).json({ error: 'Missing bearer token' });
  }

  const adminSupabase = getAdminSupabaseClient();
  const { data: authData, error: authError } =
    await adminSupabase.auth.getUser(accessToken);

  if (authError || !authData.user) {
    return res.status(401).json({
      error: 'Invalid access token',
      details: authError?.message || 'Supabase rejected the session token',
    });
  }

  const authUser = authData.user;

  const { data: userRow, error: userError } = await adminSupabase
    .from('users')
    .select('id, first_name, last_name, email, phone, handicap, ghin')
    .eq('id', authUser.id)
    .maybeSingle();

  if (userError) {
    return res.status(500).json({
      error: 'Unable to load profile',
      details: userError.message,
    });
  }

  const { data: memberRows, error: memberError } = await adminSupabase
    .from('group_memberships')
    .select('group_id, user_id, role')
    .eq('user_id', authUser.id);

  if (memberError) {
    return res.status(500).json({
      error: 'Unable to load group memberships',
      details: memberError.message,
    });
  }

  const groupIds = [...new Set((memberRows || []).map(row => row.group_id))];
  const currentUser = toUser(userRow, authUser);

  if (groupIds.length === 0) {
    return res.status(200).json({
      data: {
        users: [currentUser],
        groups: [],
        games: [],
      },
    });
  }

  const [
    groupResult,
    allMembershipsResult,
    locationResult,
    gameResult,
  ] = await Promise.all([
    adminSupabase
      .from('groups')
      .select('id, name, description')
      .in('id', groupIds)
      .eq('is_active', true),
    adminSupabase
      .from('group_memberships')
      .select('group_id, user_id, role')
      .in('group_id', groupIds),
    adminSupabase
      .from('locations')
      .select('location_id, group_id, name, address, tee_time_contact, is_active')
      .in('group_id', groupIds)
      .neq('is_active', false),
    adminSupabase
      .from('games')
      .select('id, group_id, location_id, description, rules, max_players, pairing_method, assign_players, recurring, recurrence, day_of_week, first_tee_time, scheduled_date')
      .in('group_id', groupIds)
      .neq('is_active', false),
  ]);

  const firstError = [
    groupResult.error,
    allMembershipsResult.error,
    locationResult.error,
    gameResult.error,
  ].find(Boolean);

  if (firstError) {
    return res.status(500).json({
      error: 'Unable to load groups',
      details: firstError.message,
    });
  }

  const allMemberships = allMembershipsResult.data || [];
  const allMemberIds = [...new Set(allMemberships.map(row => row.user_id))];

  const userResult = allMemberIds.length
    ? await adminSupabase
        .from('users')
        .select('id, first_name, last_name, email, phone, handicap, ghin')
        .in('id', allMemberIds)
    : { data: [], error: null };

  if (userResult.error) {
    return res.status(500).json({
      error: 'Unable to load group members',
      details: userResult.error.message,
    });
  }

  const gameIds = (gameResult.data || []).map(row => row.id);
  const registrationResult = gameIds.length
    ? await adminSupabase
        .from('game_registrations')
        .select('game_id, user_id, status, position')
        .in('game_id', gameIds)
    : { data: [], error: null };

  const teeRequestResult = gameIds.length
    ? await adminSupabase
        .from('tee_time_requests')
        .select('response_id, response_token_hash, game_id, requested_time, to_pro_shop_name, to_pro_shop_email, status, response, sent_at')
        .in('game_id', gameIds)
    : { data: [], error: null };

  if (registrationResult.error || teeRequestResult.error) {
    const error = registrationResult.error || teeRequestResult.error;
    return res.status(500).json({
      error: 'Unable to load games',
      details: error.message,
    });
  }

  const users = (userResult.data || []).map(row => toUser(row, authUser));
  if (!users.some(user => user.id === currentUser.id)) {
    users.push(currentUser);
  }

  const groups = (groupResult.data || []).map(row => ({
    id: row.id,
    name: row.name || '',
    description: row.description || '',
    locations: (locationResult.data || [])
      .filter(location => location.group_id === row.id)
      .map(toLocation),
    memberships: allMemberships
      .filter(membership => membership.group_id === row.id)
      .map(membership => ({
        userId: membership.user_id,
        role: membership.role || 'player',
      })),
  }));

  const games = (gameResult.data || []).map(row => toGame(
    row,
    registrationResult.data || [],
    teeRequestResult.data || []
  ));

  return res.status(200).json({
    data: {
      users,
      groups,
      games,
    },
  });
}
