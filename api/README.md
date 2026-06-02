# API Structure

The API folders mirror the Supabase `public` schema exported on 2026-06-01.

| Folder | Supabase table | Purpose |
| --- | --- | --- |
| `games/` | `games` | Scheduled golf games |
| `game_registrations/` | `game_registrations` | Registered and waitlisted players |
| `group_invites/` | `group_invites` | Group invitation lifecycle |
| `group_memberships/` | `group_memberships` | User roles within groups |
| `groups/` | `groups` | Golf groups |
| `locations/` | `locations` | Golf courses and tee-time contacts |
| `recurring_game_series/` | `recurring_game_series` | Recurring game templates |
| `tee_time_requests/` | `tee_time_requests` | Pro-shop request and response lifecycle |
| `tee_times/` | `tee_times` | Tee-time slots |
| `users/` | `users` | User profiles |

The source export is saved at
`.linksInvite-supabase/public-schema.csv`.

## Handler Convention

API files use Vercel functions. Each executable file exports one default handler:

```js
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  return res.status(200).json({ data: {} });
}
```

Do not use Express routers or CommonJS `module.exports` in `api/`.

## Supabase

Copy `.env.example` to `.env.local` for local development and configure the same
values in the Vercel project:

```text
SUPABASE_URL=https://ihoretjurcfxvrhmxies.supabase.co
SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
```

Use `createUserSupabaseClient(accessToken)` for normal API requests so Supabase
applies the signed-in user's RLS policies. Use `getAdminSupabaseClient()` only
for server-side workflows that validate permissions before bypassing RLS.
