import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockReq, mockRes, makeSupabase } from './helpers.js';

vi.mock('../_lib/supabase.js', () => ({
  getAdminSupabaseClient: vi.fn(),
  getBearerToken: vi.fn(),
}));

import { getAdminSupabaseClient, getBearerToken } from '../_lib/supabase.js';
import handler from '../groups/onboard.js';

describe('groups/onboard — join action', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when no bearer token is present', async () => {
    getBearerToken.mockReturnValue(null);
    const req = mockReq({ method: 'POST', body: { action: 'join', joinCode: 'Augusta' } });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(401);
  });

  it('returns 401 when the bearer token is invalid', async () => {
    getBearerToken.mockReturnValue('bad-token');
    const supabase = makeSupabase([], { authUser: null, authError: new Error('invalid') });
    getAdminSupabaseClient.mockReturnValue(supabase);
    const req = mockReq({
      method: 'POST',
      body: { action: 'join', joinCode: 'Augusta' },
      headers: { authorization: 'Bearer bad-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(401);
  });

  it('returns 404 for a partial name fragment — no substring fallback allowed', async () => {
    getBearerToken.mockReturnValue('valid-token');
    // Queue: first thenable pop is the exact ilike query, returns no match
    const supabase = makeSupabase(
      [{ data: [], error: null }],
      { authUser: { id: 'user-1' } }
    );
    getAdminSupabaseClient.mockReturnValue(supabase);

    const req = mockReq({
      method: 'POST',
      // "Sunday" is a fragment of "Sunday Golf Group" — exact ilike won't match
      body: { action: 'join', joinCode: 'Sunday' },
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(404);
    expect(res._body.error).toMatch(/not found/i);
  });

  it('returns 400 when joinCode is missing', async () => {
    getBearerToken.mockReturnValue('valid-token');
    const supabase = makeSupabase([], { authUser: { id: 'user-1' } });
    getAdminSupabaseClient.mockReturnValue(supabase);
    const req = mockReq({
      method: 'POST',
      body: { action: 'join', joinCode: '' },
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  it('returns 400 for an unknown action', async () => {
    getBearerToken.mockReturnValue('valid-token');
    const supabase = makeSupabase([], { authUser: { id: 'user-1' } });
    getAdminSupabaseClient.mockReturnValue(supabase);
    const req = mockReq({
      method: 'POST',
      body: { action: 'delete' },
      headers: { authorization: 'Bearer valid-token' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
  });
});
