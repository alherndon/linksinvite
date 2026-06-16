import { createClient } from '@supabase/supabase-js';
import { getForecast } from './_lib/weather.js';

// Self-contained digest engine. A scheduler (Vercel cron once/day, or a free
// external cron every 4h) just pokes it. Idempotent: only emails when the
// roster changed since the last send, or once on the eve of game day, and
// never on game day itself. Safe to call as often as you want.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const FROM = process.env.EMAIL_FROM;
const SECRET = process.env.CRON_SECRET || process.env.ADMIN_API_SECRET;

export default async function handler(req, res) {
  // Auth: Vercel Cron auto-sends `Authorization: Bearer <CRON_SECRET>` when
  // CRON_SECRET is set. External schedulers can send that header or ?secret=.
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  const provided = bearer || req.query.secret;
  if (!SECRET || provided !== SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  if (!FROM) return res.status(500).json({ ok: false, error: 'Missing required environment variable: EMAIL_FROM' });

  const today = todayET();
  const tomorrow = addDays(today, 1);

  const { data: games, error } = await supabaseAdmin
    .from('games')
    .select('id, group_id, scheduled_date, first_tee_time, max_players, locations ( name )')
    .gt('scheduled_date', today)
    .eq('is_active', true);

  if (error) return res.status(500).json({ ok: false, error: error.message });

  const results = [];
  for (const game of games || []) {
    try {
      results.push(await processGame(game, tomorrow));
    } catch (err) {
      results.push({ game_id: game.id, sent: false, error: String(err.message || err) });
    }
  }
  return res.status(200).json({ ok: true, ran_at: new Date().toISOString(), results });
}

async function processGame(game, tomorrow) {
  const isEve = game.scheduled_date === tomorrow;

  const { data: regs } = await supabaseAdmin
    .from('game_registrations')
    .select('user_id, status, position, registered_at, email, name, users ( first_name, last_name, email )')
    .eq('game_id', game.id)
    .order('registered_at', { ascending: true });

  const registered = (regs || []).filter((r) => r.status === 'registered');
  const waitlisted = (regs || [])
    .filter((r) => r.status === 'waitlisted')
    .sort((a, b) => (a.position || 0) - (b.position || 0));

  const signature = (regs || [])
    .map((r) => `${r.user_id || r.email}:${r.status}`)
    .sort()
    .join('|');

  const { data: state } = await supabaseAdmin
    .from('digest_state')
    .select('last_sent_signature, night_before_sent')
    .eq('game_id', game.id)
    .maybeSingle();

  const prevSig = state?.last_sent_signature ?? null;
  const nightBeforeSent = state?.night_before_sent ?? false;
  const changed = signature !== prevSig;

  if (!state && (regs || []).length === 0 && !isEve) {
    return { game_id: game.id, sent: false, reason: 'no-activity' };
  }

  const shouldSend = (isEve && !nightBeforeSent) || changed;
  if (!shouldSend) return { game_id: game.id, sent: false, reason: 'no-change' };

  const recipients = (regs || [])
    .map((r) => r.users?.email || r.email)
    .filter(Boolean);
  if (recipients.length === 0) return { game_id: game.id, sent: false, reason: 'no-recipients' };

  const locationName = game.locations?.name || '';

  let weather = null;
  try {
    if (locationName) {
      // In-process forecast — no /api/weather self-fetch (deadlocks on Vercel).
      weather = await Promise.race([
        getForecast(locationName, 7),
        new Promise((resolve) => setTimeout(() => resolve(null), 6000)),
      ]);
    }
  } catch {
    /* weather failure never blocks the digest */
  }

  const subject = `Golf ${formatDate(game.scheduled_date)} - ${registered.length}/${game.max_players} in`;
  const html = digestHtml({ game, locationName, registered, waitlisted, weather });
  await sendBatch(recipients.map((email) => ({ from: FROM, to: [email], subject, html })));

  await supabaseAdmin.from('digest_state').upsert({
    game_id: game.id,
    last_sent_signature: signature,
    last_sent_at: new Date().toISOString(),
    night_before_sent: nightBeforeSent || isEve,
  });

  return {
    game_id: game.id,
    sent: true,
    recipients: recipients.length,
    reason: isEve && !nightBeforeSent ? 'eve' : 'change',
  };
}

async function sendBatch(emails) {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY is not set');
  const res = await fetch('https://api.resend.com/emails/batch', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(emails),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Resend batch ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

function playerName(row) {
  const fn = row.users?.first_name || '';
  const ln = row.users?.last_name || '';
  const accountName = (fn + ' ' + ln).trim();
  return (
    accountName ||
    row.name ||
    (row.email ? row.email.split('@')[0] : 'Golfer')
  );
}

function digestHtml({ game, locationName, registered, waitlisted, weather }) {
  const spots = Math.max(0, game.max_players - registered.length);
  const regList = registered.length
    ? registered.map((r) => `<li>${escapeHtml(playerName(r))}</li>`).join('')
    : '<li style="color:#8a958a;">No one registered yet</li>';
  const waitBlock = waitlisted.length
    ? `<p style="margin:16px 0 4px;font-weight:600;">Waitlist</p>
       <ol style="margin:0 0 0 18px;padding:0;">${waitlisted
         .map((r) => `<li>${escapeHtml(playerName(r))}</li>`)
         .join('')}</ol>`
    : '';

  let forecast = '';
  if (weather?.days?.length) {
    const rows = weather.days
      .map(
        (d) => `<tr>
          <td style="padding:6px 10px;border-top:1px solid #eef1ee;">${escapeHtml(d.dayName)}</td>
          <td style="padding:6px 10px;border-top:1px solid #eef1ee;">${escapeHtml(d.condition)}</td>
          <td style="padding:6px 10px;border-top:1px solid #eef1ee;">${escapeHtml(d.temp)}</td>
          <td style="padding:6px 10px;border-top:1px solid #eef1ee;">${escapeHtml(d.rainChance)} rain</td>
        </tr>`
      )
      .join('');
    forecast = `<p style="margin:22px 0 6px;font-weight:600;">7-day forecast - ${escapeHtml(weather.courseName || locationName)}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px;border-collapse:collapse;">${rows}</table>
      ${weather.overallAdvice ? `<p style="margin:10px 0 0;color:#4a5a4a;font-size:13px;">${escapeHtml(weather.overallAdvice)}</p>` : ''}`;
  }

  return `<div style="background:#f4f6f4;padding:24px 0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;max-width:520px;width:100%;">
      <tr><td style="background:#1e6b2f;padding:18px 24px;color:#ffffff;font-size:18px;font-weight:600;">LinksInvite</td></tr>
      <tr><td style="padding:24px;color:#1a2e1a;font-size:15px;line-height:1.55;">
        <p style="margin:0 0 2px;font-size:17px;font-weight:600;">${escapeHtml(formatDate(game.scheduled_date))}</p>
        <p style="margin:0 0 12px;color:#4a5a4a;">${escapeHtml(locationName)}</p>
        <p style="margin:0 0 4px;"><strong>${registered.length} registered</strong> &middot; ${spots} spot${spots === 1 ? '' : 's'} available</p>
        <p style="margin:0 0 12px;color:#4a5a4a;">First tee time ${escapeHtml(formatTime(game.first_tee_time))} &mdash; plan to arrive for the first group.</p>
        <p style="margin:16px 0 4px;font-weight:600;">Playing</p>
        <ol style="margin:0 0 0 18px;padding:0;">${regList}</ol>
        ${waitBlock}
        ${forecast}
      </td></tr>
    </table>
  </td></tr></table>
</div>`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function todayET() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

function formatDate(d) {
  if (!d) return '';
  const [y, m, day] = String(d).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, day));
  const wd = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][date.getUTCDay()];
  const mo = ['January','February','March','April','May','June','July','August','September','October','November','December'][m - 1];
  return `${wd}, ${mo} ${day}`;
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = String(t).split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = ((hour + 11) % 12) + 1;
  return `${h12}:${m} ${ampm}`;
}
