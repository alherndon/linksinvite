import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockReq, mockRes } from './helpers.js';

// weather.js holds a module-level geoCache Map.
// Reset modules before each test so the cache starts empty.
beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

const NOMINATIM_RESPONSE = [
  { lat: '33.5031', lon: '-82.0197', display_name: 'Augusta National Golf Club, Augusta, GA, USA' },
];

const OPEN_METEO_RESPONSE = {
  daily: {
    time: ['2026-06-12', '2026-06-13', '2026-06-14'],
    weathercode: [0, 1, 2],
    temperature_2m_max: [82, 79, 85],
    temperature_2m_min: [65, 63, 68],
    precipitation_probability_max: [5, 15, 25],
  },
};

function stubFetch(nominatimCalls) {
  vi.stubGlobal('fetch', async (url) => {
    if (url.includes('nominatim')) {
      nominatimCalls.count++;
      return { json: async () => NOMINATIM_RESPONSE };
    }
    // open-meteo
    return { json: async () => OPEN_METEO_RESPONSE };
  });
}

describe('weather handler — geocode cache', () => {
  it('calls Nominatim only once for the same location across two requests', async () => {
    const calls = { count: 0 };
    stubFetch(calls);

    const { default: handler } = await import('../weather.js');

    const res1 = mockRes();
    await handler(mockReq({ method: 'GET', query: { location: 'Augusta National' } }), res1);

    const res2 = mockRes();
    await handler(mockReq({ method: 'GET', query: { location: 'Augusta National' } }), res2);

    expect(calls.count).toBe(1);
    expect(res1._status).toBe(200);
    expect(res2._status).toBe(200);
  });

  it('calls Nominatim for each distinct location', async () => {
    const calls = { count: 0 };
    stubFetch(calls);

    const { default: handler } = await import('../weather.js');

    await handler(mockReq({ method: 'GET', query: { location: 'Augusta National' } }), mockRes());
    await handler(mockReq({ method: 'GET', query: { location: 'Pebble Beach' } }), mockRes());

    expect(calls.count).toBe(2);
  });

  it('treats the same location case-insensitively', async () => {
    const calls = { count: 0 };
    stubFetch(calls);

    const { default: handler } = await import('../weather.js');

    await handler(mockReq({ method: 'GET', query: { location: 'Augusta National' } }), mockRes());
    await handler(mockReq({ method: 'GET', query: { location: 'augusta national' } }), mockRes());

    expect(calls.count).toBe(1);
  });

  it('returns 400 when location query param is missing', async () => {
    const { default: handler } = await import('../weather.js');
    const res = mockRes();
    await handler(mockReq({ method: 'GET', query: {} }), res);
    expect(res._status).toBe(400);
  });

  it('returns 405 for non-GET methods', async () => {
    const { default: handler } = await import('../weather.js');
    const res = mockRes();
    await handler(mockReq({ method: 'POST', query: {} }), res);
    expect(res._status).toBe(405);
  });
});
