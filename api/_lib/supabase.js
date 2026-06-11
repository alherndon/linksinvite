import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey =
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

export function getAdminSupabaseClient() {
  if (!url || !serviceKey)
    throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY');
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createUserSupabaseClient(accessToken) {
  if (!url || !anonKey)
    throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export function getBearerToken(req) {
  const auth = req.headers['authorization'] || '';
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}
