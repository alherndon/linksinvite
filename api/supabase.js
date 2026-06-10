import { createClient } from '@supabase/supabase-js';

// Server-side Supabase client using the SERVICE-ROLE key.
// This client BYPASSES RLS, so it must ONLY ever run inside serverless
// functions — never imported into the React/browser bundle. The key comes
// from SUPABASE_SECRET_KEY, a server-only env var (no VITE_ prefix).
const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !serviceKey) {
  console.warn('[supabase] Missing SUPABASE_URL or SUPABASE_SECRET_KEY');
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
