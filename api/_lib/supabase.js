import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const publishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
const secretKey =
  process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const serverAuthOptions = {
  auth: {
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: false,
  },
};

function requireEnvironmentVariable(value, name) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

/**
 * Creates a request-scoped client that applies the signed-in user's RLS policies.
 */
export function createUserSupabaseClient(accessToken) {
  const url = requireEnvironmentVariable(supabaseUrl, 'SUPABASE_URL');
  const key = requireEnvironmentVariable(
    publishableKey,
    'SUPABASE_PUBLISHABLE_KEY'
  );

  if (!accessToken) {
    throw new Error('Missing Supabase access token');
  }

  return createClient(url, key, {
    ...serverAuthOptions,
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

let adminClient;

/**
 * Creates a server-only client that bypasses RLS.
 * Validate the signed-in user and their permissions before using this client.
 */
export function getAdminSupabaseClient() {
  if (!adminClient) {
    const url = requireEnvironmentVariable(supabaseUrl, 'SUPABASE_URL');
    const key = requireEnvironmentVariable(
      secretKey,
      'SUPABASE_SECRET_KEY'
    );

    adminClient = createClient(url, key, serverAuthOptions);
  }

  return adminClient;
}

export function getBearerToken(req) {
  const authorization = req.headers.authorization || '';
  const [scheme, token] = authorization.split(' ');

  return scheme.toLowerCase() === 'bearer' && token ? token : null;
}
