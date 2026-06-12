import { createHash } from 'node:crypto';
import { getAdminSupabaseClient } from '../_lib/supabase.js';

const ACTIONS = new Set(['yes', 'no', 'waitlist']);

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

const ACTION_LABELS = { yes: "Yes, I'm in", no: "I can't make it", waitlist: 'Add me to the waitlist' };

const PAGE_STYLE = `
  body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:Arial,sans-serif;background:#f7faf8;color:#17231c}
  main{width:min(520px,calc(100vw - 32px));border:1px solid #d9e5dc;border-radius:8px;background:#fff;padding:28px;box-shadow:0 12px 36px rgba(23,35,28,.08)}
  h1{margin:0 0 10px;font-size:24px}
  p{margin:0;line-height:1.5;color:#4a5d52}
  .btn{display:inline-block;margin-top:20px;padding:12px 28px;background:#1e6b2f;color:#fff;border:none;border-radius:8px;font-size:16px;font-family:inherit;cursor:pointer;text-decoration:none}
  .btn:hover{background:#155a24}
`;

function htmlPage({ title, body }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${title}</title><style>${PAGE_STYLE}</style></head><body><main>${body}</main></body></html>`;
}

function confirmPage(token, action) {
  const label = ACTION_LABELS[action] || action;
  return htmlPage({
    title: 'Confirm your response',
    body: `<h1>Confirm your response</h1>
      <p>You're about to record: <strong>${label}</strong>.</p>
      <form method="POST" action="/api/email/respond">
        <input type="hidden" name="token" value="${token}">
        <input type="hidden" name="action" value="${action}">
        <button class="btn" type="submit">${label}</button>
      </form>`,
  });
}

function resultPage({ title, message }) {
  return htmlPage({ title, body: `<h1>${title}</h1><p>${message}</p>` });
}

function sendResult(req, res, status, payload) {
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(status).send(resultPage({ title: payload.title, message: payload.message }));
  }
  return res.status(status).json(payload);
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
    return sendResult(req, res, 400, {
      title: 'Missing Link',
      message: 'This response link is missing its token.',
      error: 'Missing response token',
    });
  }

  if (!ACTIONS.has(action)) {
    return sendResult(req, res, 400, {
      title: 'Invalid Response',
      message: 'This response link does not include a valid action.',
      error: 'Invalid response action',
    });
  }

  // GET: verify the link is valid, then show a confirmation page.
  // This prevents email prefetchers from silently consuming the token.
  if (req.method === 'GET') {
    try {
      const supabase = getAdminSupabaseClient();
      const { data: notification, error: findError } = await findNotification(supabase, token);
      if (findError) throw new Error('Unable to load notification');

      if (!notification) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(404).send(resultPage({ title: 'Invalid Link', message: 'This response link is not valid.' }));
      }

      if (notification.responded_at) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(resultPage({ title: 'Already Recorded', message: 'This response link was already used.' }));
      }

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(200).send(confirmPage(token, action));
    } catch (error) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(500).send(resultPage({ title: 'Something Went Wrong', message: error.message || 'Unable to load this link.' }));
    }
  }

  // POST: apply the action.
  try {
    const supabase = getAdminSupabaseClient();
    const { data: notification, error: findError } = await findNotification(supabase, token);

    if (findError) throw new Error('Unable to load notification');

    if (!notification) {
      return sendResult(req, res, 404, {
        title: 'Invalid Link',
        message: 'This response link is not valid.',
        error: 'Invalid response link',
      });
    }

    if (notification.responded_at) {
      return sendResult(req, res, 409, {
        title: 'Already Recorded',
        message: 'This response link was already used.',
        error: 'This notification was already answered',
      });
    }

    const result = await applyGameAction(supabase, notification, action);
    const respondedAt = new Date().toISOString();
    const { data: updatedNotification, error: updateError } = await supabase
      .from('notification_events')
      .update({ response_status: action, responded_at: respondedAt })
      .eq('id', notification.id)
      .is('responded_at', null)
      .select()
      .single();

    if (updateError) throw new Error('Unable to record response');

    return sendResult(req, res, 200, {
      title: 'Response Recorded',
      message: result.message,
      data: updatedNotification,
      result,
    });
  } catch (error) {
    return sendResult(req, res, error.statusCode || 500, {
      title: 'Something Went Wrong',
      message: error.message || 'Unable to record your response.',
      error: error.message || 'Unable to record response',
    });
  }
}
