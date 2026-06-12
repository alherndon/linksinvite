import { vi } from 'vitest';

// ── Request / response mocks ──────────────────────────────────────────────────

/**
 * Build a mock Vercel request.
 * rawBody is used by status.js which streams the body itself (bodyParser disabled).
 */
export function mockReq({ method = 'GET', body = {}, query = {}, headers = {}, rawBody = '' } = {}) {
  const req = { method, body, query, headers };

  // Make the request async-iterable so readRawBody() in status.js can consume it.
  req[Symbol.asyncIterator] = async function* () {
    if (rawBody) yield Buffer.from(rawBody);
  };

  return req;
}

export function mockRes() {
  const r = { _status: 200, _body: null, _headers: {} };
  r.status = (code) => { r._status = code; return r; };
  r.json  = (body) => { r._body  = body; return r; };
  r.send  = (body) => { r._body  = body; return r; };
  r.end   = ()     => r;
  r.setHeader = (k, v) => { r._headers[k] = v; return r; };
  return r;
}

// ── Supabase mock ─────────────────────────────────────────────────────────────

/**
 * Creates a chainable Supabase client mock.
 *
 * results[]  — queue of { data, error } objects consumed by terminal calls
 *              (single / maybeSingle) or direct awaits (delete/update chains).
 * authUser   — user returned by auth.getUser(); pass null to simulate 401.
 * authError  — error returned by auth.getUser().
 */
export function makeSupabase(results = [], { authUser = { id: 'user-1' }, authError = null } = {}) {
  let idx = 0;
  const next = () => Promise.resolve(results[idx++] ?? { data: null, error: null });

  const mock = {
    // auth.getUser
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: authUser },
        error: authError,
      }),
    },

    // Chain methods — all return `mock` so any fluent chain resolves to this object.
    from:       vi.fn().mockReturnThis(),
    select:     vi.fn().mockReturnThis(),
    insert:     vi.fn().mockReturnThis(),
    update:     vi.fn().mockReturnThis(),
    upsert:     vi.fn().mockReturnThis(),
    delete:     vi.fn().mockReturnThis(),
    eq:         vi.fn().mockReturnThis(),
    neq:        vi.fn().mockReturnThis(),
    gt:         vi.fn().mockReturnThis(),
    in:         vi.fn().mockReturnThis(),
    is:         vi.fn().mockReturnThis(),
    ilike:      vi.fn().mockReturnThis(),
    order:      vi.fn().mockReturnThis(),
    limit:      vi.fn().mockReturnThis(),

    // Terminal methods pop the results queue.
    single:     vi.fn().mockImplementation(next),
    maybeSingle: vi.fn().mockImplementation(next),

    // Make the mock itself thenable so `await chain.delete().eq().eq()` works
    // (no explicit terminal call — the chain is awaited directly).
    then:   (resolve, reject) => next().then(resolve, reject),
    catch:  (reject)          => next().catch(reject),
    finally:(fn)              => next().finally(fn),
  };

  return mock;
}
