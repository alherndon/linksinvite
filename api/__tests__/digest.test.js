import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockReq, mockRes } from './helpers.js';

// digest.js creates supabaseAdmin at module scope via createClient().
// Mock the entire package so module initialization doesn't fail without env vars.
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    // Make chains thenable so they resolve without throwing
    then: (resolve) => resolve({ data: [], error: null }),
    catch: vi.fn().mockReturnThis(),
    finally: vi.fn().mockReturnThis(),
  })),
}));

// Import AFTER the mock is hoisted and in place.
// With no CRON_SECRET env var set, the module-level SECRET = undefined.
import handler from '../digest.js';

describe('digest — authorization guard', () => {
  beforeEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.ADMIN_API_SECRET;
  });

  it('returns 401 when no secret is configured (CRON_SECRET not set)', async () => {
    const req = mockReq({ method: 'GET' });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(401);
    expect(res._body.ok).toBe(false);
  });

  it('returns 401 even when caller provides an Authorization header but secret is unconfigured', async () => {
    // SECRET is undefined at module load time — any provided token is rejected
    const req = mockReq({
      method: 'GET',
      headers: { authorization: 'Bearer any-secret' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(401);
  });

  it('returns 401 when caller provides wrong ?secret= query param', async () => {
    const req = mockReq({
      method: 'GET',
      query: { secret: 'wrong-secret' },
    });
    const res = mockRes();
    await handler(req, res);
    expect(res._status).toBe(401);
  });
});
