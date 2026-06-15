import {
  getAdminSupabaseClient,
  getBearerToken,
} from '../_lib/supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.PUBLIC_APP_URL || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const accessToken = getBearerToken(req);
  if (!accessToken) return res.status(401).json({ error: 'Missing bearer token' });

  const adminSupabase = getAdminSupabaseClient();
  const { data: authData, error: authError } =
    await adminSupabase.auth.getUser(accessToken);
  if (authError || !authData?.user) {
    return res.status(401).json({ error: 'Invalid access token' });
  }

  const email = String(req.query.email || '').toLowerCase().trim();
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Missing or invalid email parameter' });
  }

  const { data: user, error } = await adminSupabase
    .from('users')
    .select('id, first_name, last_name, email')
    .eq('email', email)
    .maybeSingle();

  if (error) return res.status(500).json({ error: 'Lookup failed' });

  if (!user) return res.status(200).json({ found: false });

  return res.status(200).json({
    found: true,
    userId: user.id,
    firstName: user.first_name || '',
    lastName: user.last_name || '',
    email: user.email,
  });
}
