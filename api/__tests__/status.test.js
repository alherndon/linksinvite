import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockReq, mockRes, makeSupabase } from './helpers.js';

vi.mock('../_lib/supabase.js', () => ({
  getAdminSupabaseClient: vi.fn(),
}));

import { getAdminSupabaseClient } from '../_lib/supabase.js';
import handler from '../email/status.js';

describe('email/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.EMAIL_WEBHOOK_SECRET;
  });

  it('returns 401 (fail-closed) when EMAIL_WEBHOOK_SECRET is not configured', async () => {
    const req = mockReq({ method: 'POST', rawBody: '{"type":"email.sent"}' });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(401);
  });

  it('returns 401 when bearer token does not match secret', async () => {
    process.env.EMAIL_WEBHOOK_SECRET = 'correct-secret';
    const req = mockReq({
      method: 'POST',
      rawBody: '{"type":"email.sent","data":{"email_id":"msg-1"}}',
      headers: { authorization: 'Bearer wrong-secret' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(401);
  });

  it('returns 400 when the payload contains no provider message id', async () => {
    process.env.EMAIL_WEBHOOK_SECRET = 'secret123';
    getAdminSupabaseClient.mockReturnValue(makeSupabase([]));
    const req = mockReq({
      method: 'POST',
      // email.sent with no data.email_id / data.id
      rawBody: '{"type":"email.sent","data":{}}',
      headers: { authorization: 'Bearer secret123' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(400);
  });

  it('returns 200 and matched:true when a notification row is found and updated', async () => {
    process.env.EMAIL_WEBHOOK_SECRET = 'secret123';
    const record = { id: 'evt-1', delivery_status: 'delivered' };
    getAdminSupabaseClient.mockReturnValue(
      makeSupabase([{ data: record, error: null }])
    );
    const req = mockReq({
      method: 'POST',
      rawBody: '{"type":"email.delivered","data":{"email_id":"msg-abc"}}',
      headers: { authorization: 'Bearer secret123' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(200);
    expect(res._body.matched).toBe(true);
    expect(res._body.data).toEqual(record);
  });

  it('returns 202 and matched:false when no matching row exists', async () => {
    process.env.EMAIL_WEBHOOK_SECRET = 'secret123';
    getAdminSupabaseClient.mockReturnValue(
      makeSupabase([{ data: null, error: null }])
    );
    const req = mockReq({
      method: 'POST',
      rawBody: '{"type":"email.delivered","data":{"email_id":"msg-xyz"}}',
      headers: { authorization: 'Bearer secret123' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(202);
    expect(res._body.matched).toBe(false);
  });

  it('returns 405 for non-POST methods', async () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(405);
  });
});
