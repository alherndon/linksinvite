import {
  getAdminSupabaseClient,
  getBearerToken,
} from '../_lib/supabase.js';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function firstValue(value) {
  return Array.isArray(value) ? value[0] : value;
}

async function handleAddPlayer(req, res, adminSupabase, callerId) {
  const { gameId, userId } = req.body || {};
  if (!gameId) return res.status(400).json({ error: 'gameId is required' });
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const { data: game, error: gameError } = await adminSupabase
    .from('games')
    .select('id, group_id, max_players')
    .eq('id', gameId)
    .maybeSingle();

  if (gameError) return res.status(500).json({ error: 'Unable to load game' });
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const { data: membership, error: membershipError } = await adminSupabase
    .from('group_memberships')
    .select('role')
    .eq('group_id', game.group_id)
    .eq('user_id', callerId)
    .maybeSingle();

  if (membershipError) return res.status(500).json({ error: 'Unable to validate membership' });
  if (!membership || !['superadmin', 'admin'].includes(membership.role)) {
    return res.status(403).json({ error: 'Only group admins can add players' });
  }

  const { data: existingRegs, error: regsError } = await adminSupabase
    .from('game_registrations')
    .select('status, position')
    .eq('game_id', gameId);

  if (regsError) return res.status(500).json({ error: 'Unable to load registrations' });

  const registeredCount = (existingRegs || []).filter(r => r.status === 'registered').length;
  const maxPlayers = Number(game.max_players) || 16;
  const status = registeredCount < maxPlayers ? 'registered' : 'waitlisted';
  const waitlistPositions = (existingRegs || [])
    .filter(r => r.status === 'waitlisted')
    .map(r => Number(r.position) || 0);
  const position = status === 'waitlisted' ? Math.max(0, ...waitlistPositions) + 1 : null;

  const { data, error } = await adminSupabase
    .from('game_registrations')
    .upsert({ game_id: gameId, user_id: userId, status, position }, { onConflict: 'game_id,user_id' })
    .select()
    .single();

  if (error) return res.status(500).json({ error: 'Unable to add player', details: error.message });

  return res.status(200).json({ data, status });
}

async function handleRemovePlayer(req, res, adminSupabase, callerId) {
  const { gameId, userId } = req.body || {};
  if (!gameId) return res.status(400).json({ error: 'gameId is required' });
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const { data: game, error: gameError } = await adminSupabase
    .from('games')
    .select('id, group_id')
    .eq('id', gameId)
    .maybeSingle();

  if (gameError) return res.status(500).json({ error: 'Unable to load game' });
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const { data: membership, error: membershipError } = await adminSupabase
    .from('group_memberships')
    .select('role')
    .eq('group_id', game.group_id)
    .eq('user_id', callerId)
    .maybeSingle();

  if (membershipError) return res.status(500).json({ error: 'Unable to validate membership' });
  if (!membership || !['superadmin', 'admin'].includes(membership.role)) {
    return res.status(403).json({ error: 'Only group admins can remove players' });
  }

  const { error } = await adminSupabase
    .from('game_registrations')
    .delete()
    .eq('game_id', gameId)
    .eq('user_id', userId);

  if (error) return res.status(500).json({ error: 'Unable to remove player', details: error.message });

  return res.status(200).json({ removed: true });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.PUBLIC_APP_URL || '*');
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

  const adminSupabase = getAdminSupabaseClient();
  const { data: authData, error: authError } =
    await adminSupabase.auth.getUser(accessToken);

  if (authError || !authData.user) {
    return res.status(401).json({
      error: 'Invalid access token',
      details: authError?.message || 'Supabase rejected the session token',
    });
  }

  if (req.body?.action === 'add-player') {
    return handleAddPlayer(req, res, adminSupabase, authData.user.id);
  }

  if (req.body?.action === 'remove-player') {
    return handleRemovePlayer(req, res, adminSupabase, authData.user.id);
  }

  const game = req.body?.game || req.body;
  const location = req.body?.location || null;
  const gameId = normalizeText(game?.id);
  const groupId = normalizeText(game?.group_id);

  if (!gameId || !groupId) {
    return res.status(400).json({ error: 'Game id and group id are required' });
  }

  const { data: membership, error: membershipError } = await adminSupabase
    .from('group_memberships')
    .select('group_id, user_id, role')
    .eq('group_id', groupId)
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (membershipError) {
    return res.status(500).json({
      error: 'Unable to validate group membership',
      details: membershipError.message,
    });
  }

  if (!membership) {
    return res.status(403).json({ error: 'You must be a group member to add games' });
  }

  if (!['superadmin', 'admin'].includes(membership.role)) {
    return res.status(403).json({ error: 'Only group admins can create or edit games' });
  }

  const { data: existingGame, error: existingError } = await adminSupabase
    .from('games')
    .select('id, group_id')
    .eq('id', gameId)
    .maybeSingle();

  if (existingError) {
    return res.status(500).json({
      error: 'Unable to validate existing game',
      details: existingError.message,
    });
  }

  if (existingGame && existingGame.group_id !== groupId) {
    return res.status(403).json({ error: 'This game belongs to another group' });
  }

  let locationId = normalizeText(game?.location_id) || normalizeText(location?.location_id) || null;

  if (location) {
    const locationRecord = {
      location_id: locationId || undefined,
      group_id: groupId,
      name: normalizeText(location?.name),
      address: normalizeText(location?.address),
      tee_time_contact: location?.tee_time_contact || { name: '', email: '', phone: '' },
      is_active: location?.is_active !== false,
    };

    if (!locationRecord.name) {
      return res.status(400).json({ error: 'Course name is required' });
    }

    const { data: locationData, error: locationError } = await adminSupabase
      .from('locations')
      .upsert(locationRecord)
      .select('location_id')
      .single();

    if (locationError) {
      return res.status(500).json({
        error: 'Unable to save location',
        details: locationError.message,
      });
    }

    locationId = locationData.location_id;
  }

  const record = {
    id: gameId,
    group_id: groupId,
    location_id: locationId,
    description: normalizeText(game?.description) || null,
    rules: normalizeText(game?.rules) || null,
    max_players: Number(game?.max_players) || 16,
    pairing_method: normalizeText(firstValue(game?.pairing_method)) || 'balanced',
    assign_players: Boolean(game?.assign_players),
    recurring: Boolean(game?.recurring),
    recurrence: game?.recurrence || null,
    day_of_week: normalizeText(firstValue(game?.day_of_week)),
    first_tee_time: normalizeText(game?.first_tee_time),
    scheduled_date: normalizeText(game?.scheduled_date),
    is_active: game?.is_active !== false,
  };

  if (!record.location_id) {
    return res.status(400).json({ error: 'Choose a location before saving the game' });
  }

  if (!record.day_of_week || !record.first_tee_time || !record.scheduled_date) {
    return res.status(400).json({
      error: 'Day, date, and tee time are required',
    });
  }

  const { data, error } = await adminSupabase
    .from('games')
    .upsert(record)
    .select('id, group_id')
    .single();

  if (error) {
    return res.status(500).json({
      error: 'Unable to save game',
      details: error.message,
    });
  }

  return res.status(existingGame ? 200 : 201).json({ data });
}
