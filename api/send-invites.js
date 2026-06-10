import { createClient } from '@supabase/supabase-js';

// Self-contained (no _lib import) so nothing fails to bundle on Vercel.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const FROM = process.env.EMAIL_FROM || 'LinksInvite <onboarding@resend.dev>';
const APP_URL = (process.env.PUBLIC_APP_URL || '').replace(/\/$/, '');
const ADMIN_SECRET = process.env.ADMIN_API_SECRET;

// Send invites for one game to the owner's whole roster.
//   /api/send-invites?game_id=<id>&secret=<ADMIN_API_SECRET>
//
// INTERIM AUTH: until the owner admin UI exists, this endpoint is guarded by a
// shared secret in ADMIN_API_SECRET so it isn't open to the public internet
// (an unguarded invite blaster would let anyone spam your roster). Replace this
// with real owner-auth when the admin screen is built.
export default async function handler(req, res) {
  const provided = req.method === 'POST' ? req.body?.secret : req.query.secret;
  if (!ADMIN_SECRET || provided !== ADMIN_SECRET) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

  const gameId = req.method === 'POST' ? req.body?.game_id : req.query.game_id;
  if (!gameId) return res.status(400).json({ ok: false, error: 'game_id is required' });

  // 1. Load the game (need its owner to find the roster).
  const { data: game, error: gameErr } = await supabaseAdmin
    .from('games')
    .select('id, owner_id, location, game_date, first_tee_time')
    .eq('id', gameId)
    .single();
  if (gameErr || !game) return res.status(404).json({ ok: false, error: 'Game not found' });

  // 2. The owner's roster = default invite list (everyone).
  const { data: roster, error: rosterErr } = await supabaseAdmin
    .from('golfers')
    .select('id, name, email')
    .eq('owner_id', game.owner_id);
  if (rosterErr) return res.status(500).json({ ok: false, error: rosterErr.message });
  if (!roster || roster.length === 0) {
    return res.status(400).json({ ok: false, error: 'Roster is empty - add golfers first' });
  }

  // 3. Ensure each golfer has an invitee row. Existing rows keep their token
  //    (so links from earlier emails still work); only missing ones are added.
  const { data: existing } = await supabaseAdmin
    .from('game_invitees')
    .select('golfer_id')
    .eq('game_id', gameId);
  const have = new Set((existing || []).map((r) => r.golfer_id));
  const toAdd = roster
    .filter((g) => !have.has(g.id))
    .map((g) => ({ game_id: gameId, golfer_id: g.id }));
  if (toAdd.length) {
    const { error: insErr } = await supabaseAdmin.from('game_invitees').insert(toAdd);
    if (insErr) return res.status(500).json({ ok: false, error: insErr.message });
  }

  // 4. Pull every invitee with its token + golfer info.
  const { data: invitees, error: invErr } = await supabaseAdmin
    .from('game_invitees')
    .select('token, golfers ( name, email )')
    .eq('game_id', gameId);
  if (invErr) return res.status(500).json({ ok: false, error: invErr.message });

  // 5. One personalized email per golfer, sent in a single batch request.
  const subject = `Golf invite: ${formatDate(game.game_date)}`;
  const emails = invitees.map((inv) => ({
    from: FROM,
    to: [inv.golfers.email],
    subject,
    html: inviteHtml(inv.golfers.name, game, inv.token),
  }));

  try {
    const result = await sendBatch(emails);
    return res.status(200).json({ ok: true, invited: emails.length, result });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err.message || err) });
  }
}

// Resend batch endpoint: up to 100 personalized emails in one request, so no
// rate-limit juggling and no risk of the function timing out on a loop.
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

function inviteHtml(name, game, token) {
  const reg = `${APP_URL}/api/respond?token=${token}&action=register`;
  const unreg = `${APP_URL}/api/respond?token=${token}&action=unregister`;
  const when = `${formatDate(game.game_date)} - first tee time ${formatTime(game.first_tee_time)}`;
  return `<div style="background:#f4f6f4;padding:24px 0;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;max-width:480px;width:100%;">
      <tr><td style="background:#1e6b2f;padding:18px 24px;color:#ffffff;font-size:18px;font-weight:600;">LinksInvite</td></tr>
      <tr><td style="padding:24px;color:#1a2e1a;font-size:15px;line-height:1.55;">
        <p style="margin:0 0 12px;">Hi ${escapeHtml(name)},</p>
        <p style="margin:0 0 4px;">You're invited to golf:</p>
        <p style="margin:0 0 4px;font-size:17px;font-weight:600;">${escapeHtml(when)}</p>
        <p style="margin:0 0 20px;color:#4a5a4a;">${escapeHtml(game.location)}</p>
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="padding-right:10px;">
            <a href="${reg}" style="display:inline-block;background:#1e6b2f;color:#ffffff;text-decoration:none;padding:11px 22px;border-radius:6px;font-weight:600;font-size:15px;">Register</a>
          </td>
          <td>
            <a href="${unreg}" style="display:inline-block;background:#eef1ee;color:#1a2e1a;text-decoration:none;padding:11px 22px;border-radius:6px;font-weight:600;font-size:15px;">Can't make it</a>
          </td>
        </tr></table>
        <p style="margin:20px 0 0;color:#8a958a;font-size:12px;">This link is just for you - please don't forward it.</p>
      </td></tr>
    </table>
  </td></tr></table>
</div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
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
