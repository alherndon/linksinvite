import { createHash } from 'node:crypto';
import { getAdminSupabaseClient } from '../_lib/supabase.js';

const ACTIONS = new Set(['yes', 'no', 'waitlist']);

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

const PAGE_STYLE = `
  body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Arial,sans-serif;background:#f7faf8;color:#17231c}
  main{width:min(520px,calc(100vw - 32px));border:1px solid #d9e5dc;border-radius:8px;background:#fff;padding:28px;box-shadow:0 12px 36px rgba(23,35,28,.08)}
  h1{margin:0 0 10px;font-size:24px}
  p{margin:0;line-height:1.5;color:#4a5d52}
`;

function resultPage({ title, message }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title><style>${PAGE_STYLE}</style></head><body><main><h1>${title}</h1><p>${message}</p></main></body></html>`;
}

async function findNotification(supabase, token) {
  return supabase
    .from('notification_events')
    .select('id, group_id, game_id, user_id, event_type, response_token_hash, responded_at, response_status')
    .eq('response_token_hash', hashToken(token))
    .maybeSingle();
}

async function getGame(supabase, gameId) {
  const { data, error } = await supabase
    .from('games')
    .select('id, max_players')
    .eq('id', gameId)
    .maybeSingle();

  if (error) {
    throw new Error('Unable to load game');
  }

  if (!data) {
    const err = new Error('Game not found');
    err.statusCode = 404;
    throw err;
  }

  return data;
}

async function getRegistrationCounts(supabase, gameId) {
  const { data, error } = await supabase
    .from('game_registrations')
    .select('user_id, status, position')
    .eq('game_id', gameId);

  if (error) {
    throw new Error('Unable to load game registrations');
  }

  const rows = data || [];
  const registeredCount = rows.filter((row) =>
    String(row.status || '').includes('registered')
  ).length;
  const waitlistPositions = rows
    .filter((row) => String(row.status || '').includes('waitlisted'))
    .map((row) => Number(row.position) || 0);

  return {
    registeredCount,
    nextWaitlistPosition: Math.max(0, ...waitlistPositions) + 1,
  };
}

async function applyGroupInviteAction(supabase, notification, action) {
  if (action === 'no') {
    if (notification.user_id) {
      await supabase
        .from('group_memberships')
        .delete()
        .eq('group_id', notification.group_id)
        .eq('user_id', notification.user_id);
    }
    return { applied: true, message: 'You have declined the group invitation.' };
  }

  if (action === 'yes') {
    if (!notification.user_id) {
      const appUrl = (process.env.PUBLIC_APP_URL || '').replace(/\/$/, '');
      const link = appUrl
        ? `<a href="${appUrl}" style="color:#1e6b2f;font-weight:600">create a LinksInvite account</a>`
        : 'create a LinksInvite account';
      return {
        applied: false,
        message: `To join this group, please ${link} first. Once you have an account, ask the admin to re-send your invite.`,
      };
    }
    const { error } = await supabase
      .from('group_memberships')
      .upsert({ group_id: notification.group_id, user_id: notification.user_id, role: 'player' });
    if (error) throw new Error('Unable to add you to the group');
    return {
      applied: true,
      message: "You're in the group! Sign in to LinksInvite to see upcoming games.",
    };
  }

  return { applied: false, message: 'Your response was recorded.' };
}

async function applyGameAction(supabase, notification, action) {
  if (!notification.game_id || !notification.user_id) {
    return {
      applied: false,
      message:
        'Your response was recorded. No player registration was changed for this email.',
    };
  }

  if (action === 'no') {
    const { error } = await supabase
      .from('game_registrations')
      .delete()
      .eq('game_id', notification.game_id)
      .eq('user_id', notification.user_id);

    if (error) {
      throw new Error('Unable to update registration');
    }

    return {
      applied: true,
      status: 'declined',
      message: 'You are marked as not playing.',
    };
  }

  const game = await getGame(supabase, notification.game_id);
  const { registeredCount, nextWaitlistPosition } = await getRegistrationCounts(
    supabase,
    notification.game_id
  );
  const maxPlayers = Number(game.max_players) || 0;
  const shouldRegister = action === 'yes' && registeredCount < maxPlayers;
  const status = shouldRegister ? 'registered' : 'waitlisted';
  const position = status === 'waitlisted' ? nextWaitlistPosition : null;

  const { error } = await supabase
    .from('game_registrations')
    .upsert({
      game_id: notification.game_id,
      user_id: notification.user_id,
      status,
      position,
    });

  if (error) {
    throw new Error('Unable to update registration');
  }

  return {
    applied: true,
    status,
    message:
      status === 'registered'
        ? "You're in! Changed your mind? Sign in to LinksInvite and tap \"I'm Out\" on the game anytime."
        : 'You have been added to the waitlist.',
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const token = req.method === 'GET' ? req.query.token : req.body?.token;
  const action = String(
    req.method === 'GET' ? req.query.action : req.body?.action || ''
  ).toLowerCase();

  if (!token || typeof token !== 'string') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(resultPage({ title: 'Missing Link', message: 'This response link is missing its token.' }));
  }

  if (!ACTIONS.has(action)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(400).send(resultPage({ title: 'Invalid Response', message: 'This response link does not include a valid action.' }));
  }

  // GET: record the response immediately and show a result page.
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    try {
      const supabase = getAdminSupabaseClient();
      const { data: notification, error: findError } = await findNotification(supabase, token);
      if (findError) throw new Error('Unable to load notification');

      if (!notification) {
        return res.status(404).send(resultPage({ title: 'Invalid Link', message: 'This response link is not valid.' }));
      }

      if (notification.responded_at) {
        return res.status(200).send(resultPage({ title: 'Already Recorded', message: 'Your response was already recorded.' }));
      }

      const result = notification.event_type === 'group_invite'
        ? await applyGroupInviteAction(supabase, notification, action)
        : await applyGameAction(supabase, notification, action);
      await supabase
        .from('notification_events')
        .update({ response_status: action, responded_at: new Date().toISOString() })
        .eq('id', notification.id)
        .is('responded_at', null);

      return res.status(200).send(resultPage({ title: 'Got it!', message: result.message }));
    } catch (error) {
      return res.status(500).send(resultPage({ title: 'Something Went Wrong', message: error.message || 'Unable to record your response.' }));
    }
  }

  // POST: apply the action.
  try {
    const supabase = getAdminSupabaseClient();
    const { data: notification, error: findError } = await findNotification(supabase, token);

    if (findError) throw new Error('Unable to load notification');

    if (!notification) {
      return res.status(404).json({ error: 'Invalid response link' });
    }

    if (notification.responded_at) {
      return res.status(409).json({ error: 'This notification was already answered' });
    }

    const result = notification.event_type === 'group_invite'
      ? await applyGroupInviteAction(supabase, notification, action)
      : await applyGameAction(supabase, notification, action);
    const respondedAt = new Date().toISOString();
    const { data: updatedNotification, error: updateError } = await supabase
      .from('notification_events')
      .update({ response_status: action, responded_at: respondedAt })
      .eq('id', notification.id)
      .is('responded_at', null)
      .select()
      .single();

    if (updateError) throw new Error('Unable to record response');

    return res.status(200).json({ message: result.message, data: updatedNotification, result });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      error: error.message || 'Unable to record response',
    });
  }
}
