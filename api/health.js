export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let supabaseHost = null;
  try {
    supabaseHost = process.env.SUPABASE_URL
      ? new URL(process.env.SUPABASE_URL).host
      : null;
  } catch {
    supabaseHost = 'invalid-url';
  }

  return res.status(200).json({
    ok: true,
    environment: process.env.VERCEL_ENV || 'local',
    supabaseHost,
    hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
    hasSupabasePublicKey: Boolean(
      process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY
    ),
    hasSupabaseSecretKey: Boolean(
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
  });
}
