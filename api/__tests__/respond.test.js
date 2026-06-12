import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockReq, mockRes, makeSupabase } from './helpers.js';

vi.mock('../_lib/supabase.js', () => ({
  getAdminSupabaseClient: vi.fn(),
}));

import { getAdminSupabaseClient } from '../_lib/supabase.js';
import handler from '../email/respond.js';

const NOTIFICATION = {
  id: 'notif-1',
  group_id: 'grp-1',
  game_id: 'game-1',
  user_id: 'user-1',
  event_type: 'invite',
  response_token_hash: 'hash-abc',
  responded_at: null,
  response_status: null,
};

describe('email/respond', () => {
  beforeEach(() => vi.clearAllMocks());

  // ── GET: confirmation page behaviour ────────────────────────────────────────

  it('GET returns HTML confirmation page without applying the action', async () => {
    getAdminSupabaseClient.mockReturnValue(
      makeSupabase([{ data: NOTIFICATION, error: null }])
    );
    const req = mockReq({ method: 'GET', query: { token: 'abc', action: 'yes' } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(typeof res._body).toBe('string');
    expect(res._body).toContain('Confirm your response');
    // Confirm page renders a POST form — does NOT mutate state
    expect(res._body).toContain('method="POST"');
    expect(res._body).toContain("Yes, I'm in");
  });

  it('GET returns "Already Recorded" page for a token that was already used', async () => {
    const usedNotification = { ...NOTIFICATION, responded_at: '2026-01-01T00:00:00Z' };
    getAdminSupabaseClient.mockReturnValue(
      makeSupabase([{ data: usedNotification, error: null }])
    );
    const req = mockReq({ method: 'GET', query: { token: 'used-token', action: 'yes' } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(200);
    expect(res._body).toContain('Already Recorded');
  });

  it('GET returns 404 HTML page when no notification matches the token', async () => {
    getAdminSupabaseClient.mockReturnValue(
      makeSupabase([{ data: null, error: null }])
    );
    const req = mockReq({ method: 'GET', query: { token: 'unknown', action: 'yes' } });
    const res = mockRes();
    await handler(req, res);

    expect(res._status).toBe(404);
    expect(res._body).toContain('Invalid Link');
  });

  // ── Validation ────────────────────────────────────────────────────────────────

  it('GET returns 400 when token is missing', async () => {
    const req = mockReq({ method: 'GET', query: { action: 'yes' } });
    const res = mockRes();
    await handler(req, res);
    // sendResult on GET returns HTML, not JSON
    expect(res._status).toBe(400);
  });

  it('GET returns 400 when action is not one of yes/no/waitlist', async () => {
    const req = mockReq({ method: 'GET', query: { token: 'abc', action: 'maybe' } });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  // ── POST: applies the action ─────────────────────────────────────────────────

  it('POST returns 409 when the token was already used', async () => {
    const usedNotification = { ...NOTIFICATION, responded_at: '2026-01-01T00:00:00Z' };
    getAdminSupabaseClient.mockReturnValue(
      makeSupabase([{ data: usedNotification, error: null }])
    );
    const req = mockReq({
      method: 'POST',
      body: { token: 'used-token', action: 'yes' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(409);
  });

  it('POST returns 404 JSON when no notification matches', async () => {
    getAdminSupabaseClient.mockReturnValue(
      makeSupabase([{ data: null, error: null }])
    );
    const req = mockReq({
      method: 'POST',
      body: { token: 'bad-token', action: 'no' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(404);
    expect(typeof res._body).toBe('object'); // JSON on POST
  });
});
