import { supabaseAdmin } from './_lib/supabase.js';

// Golfer register / unregister via a tokenized email link. No login required.
//
// Flow:
//   GET  /api/respond?token=...&action=register   -> shows a confirm page only
//   POST (the confirm button)                      -> actually applies the change
//
// Why GET never mutates: email clients and security scanners (Outlook Safe
// Links, etc.) prefetch links. If GET changed state, golfers would be
// registered/unregistered without ever clicking. Mutations happen on POST only.

export default async function handler(req, res) {
  const method = req.method || 'GET';
  const token = method === 'POST' ? req.body?.token : req.query.token;
  const action = method === 'POST' ? req.body?.action : req.query.action;

  if (!token || !['register', 'unregister'].includes(action)) {
    return html(res, 400, page('Invalid link', '<p>This link is missing or malformed.</p>'));
  }

  // Resolve the token -> which game, which golfer. The nested selects work
  // because game_invitees has foreign keys to both golfers and games.
  const { data: invite, error } = await supabaseAdmin
    .from('game_invitees')
    .select(
      'game_id, golfer_id, ' +
      'golfers ( name, email ), ' +
      'games ( location, game_date, first_tee_time, tee_times, capacity )'
    )
    .eq('token', token)
    .single();

  if (error || !invite) {
    return html(res, 404, page('Link not found', '<p>We could not find this invitation. It may have expired.</p>'));
  }

  const golfer = invite.golfers;
  const game = invite.games;
  const when = `${game.game_date} - first tee ${formatTime(game.first_tee_time)} at ${escapeHtml(game.location)}`;

  // GET: show a confirmation page whose button POSTs back here.
  if (method === 'GET') {
    const label = action === 'register' ? 'Register for' : 'Unregister from';
    return html(res, 200, page(
      `${label} this game?`,
      `<p>Hi ${escapeHtml(golfer.name)},</p>
       <p>${when}</p>
       <form method="POST" action="/api/respond">
         <input type="hidden" name="token" value="${escapeHtml(token)}" />
         <input type="hidden" name="action" value="${escapeHtml(action)}" />
         <button type="submit">Yes, ${label.toLowerCase()} this game</button>
       </form>`
    ));
  }

  // POST: apply the change.
  try {
    if (action === 'register') {
      const status = await register(invite.game_id, invite.golfer_id, game.capacity);
      const body = status === 'registered'
        ? `<p>You are <strong>confirmed</strong>.</p><p>${when}</p>
           <p>Plan to arrive for the first tee time - groups go off in order.</p>`
        : `<p>The game is full, so you are on the <strong>waitlist</strong>.</p><p>${when}</p>
           <p>You will be moved in automatically if a spot opens, and you will see it in the next group update.</p>`;
      return html(res, 200, page('Done', body));
    } else {
      await unregister(invite.game_id, invite.golfer_id);
      return html(res, 200, page('Done', `<p>You are no longer registered.</p><p>${when}</p>`));
    }
  } catch (err) {
    return html(res, 500, page('Something went wrong', `<p>${escapeHtml(String(err.message || err))}</p>`));
  }
}

// --- registration logic -----------------------------------------------------

async function register(gameId, golferId, capacity) {
  // Idempotent: if they already have a row, return its status unchanged.
  const { data: existing } = await supabaseAdmin
    .from('registrations')
    .select('status')
    .eq('game_id', gameId)
    .eq('golfer_id', golferId)
    .maybeSingle();
  if (existing) return existing.status;

  // Count confirmed players to decide registered vs waitlisted.
  // NOTE: this read-then-write has a tiny race if two golfers grab the last
  // spot in the same instant. For a ~20-person group that's fine; ask me for
  // the atomic Postgres-function version if you ever want to harden it.
  const { count } = await supabaseAdmin
    .from('registrations')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', gameId)
    .eq('status', 'registered');

  const status = (count ?? 0) < capacity ? 'registered' : 'waitlisted';

  const { error } = await supabaseAdmin
    .from('registrations')
    .insert({ game_id: gameId, golfer_id: golferId, status });
  if (error) throw error;

  return status;
}

async function unregister(gameId, golferId) {
  const { data: row } = await supabaseAdmin
    .from('registrations')
    .select('id, status')
    .eq('game_id', gameId)
    .eq('golfer_id', golferId)
    .maybeSingle();
  if (!row) return;

  await supabaseAdmin.from('registrations').delete().eq('id', row.id);

  // If a CONFIRMED player left, promote the oldest waitlisted golfer.
  // (If a waitlisted player left, nothing to promote.)
  if (row.status === 'registered') {
    const { data: next } = await supabaseAdmin
      .from('registrations')
      .select('id')
      .eq('game_id', gameId)
      .eq('status', 'waitlisted')
      .order('registered_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (next) {
      await supabaseAdmin
        .from('registrations')
        .update({ status: 'registered' })
        .eq('id', next.id);
    }
  }
}

// --- small html helpers ------------------------------------------------------

function html(res, status, body) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(status).send(body);
}

function page(title, inner) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body{font-family:system-ui,-apple-system,sans-serif;max-width:32rem;margin:3rem auto;padding:0 1rem;color:#1a2e1a;line-height:1.5}
      h1{font-size:1.35rem}
      button{background:#1e6b2f;color:#fff;border:0;border-radius:6px;padding:.7rem 1.1rem;font-size:1rem;cursor:pointer}
    </style></head>
    <body><h1>${escapeHtml(title)}</h1>${inner}</body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = ((hour + 11) % 12) + 1;
  return `${h12}:${m} ${ampm}`;
}
