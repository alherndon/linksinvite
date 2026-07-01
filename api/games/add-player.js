import { getAdminSupabaseClient, getBearerToken } from '../_lib/supabase.js';

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
  const { data: authData, error: authError } = await adminSupabase.auth.getUser(accessToken);
  if (authError || !authData.user) {
    return res.status(401).json({ error: 'Invalid access token' });
  }

  const { gameId, userId } = req.body || {};
  if (!gameId) return res.status(400).json({ error: 'gameId is required' });
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  // Verify the game exists and get its group_id
  const { data: game, error: gameError } = await adminSupabase
    .from('games')
    .select('id, group_id, max_players')
    .eq('id', gameId)
    .maybeSingle();

  if (gameError) return res.status(500).json({ error: 'Unable to load game' });
  if (!game) return res.status(404).json({ error: 'Game not found' });

  // Verify the caller is an admin of this group
  const { data: membership, error: membershipError } = await adminSupabase
    .from('group_memberships')
    .select('role')
    .eq('group_id', game.group_id)
    .eq('user_id', authData.user.id)
    .maybeSingle();

  if (membershipError) return res.status(500).json({ error: 'Unable to validate membership' });
  if (!membership || !['superadmin', 'admin'].includes(membership.role)) {
    return res.status(403).json({ error: 'Only group admins can add players' });
  }

  // Determine registered vs waitlisted
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
