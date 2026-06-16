import { getForecast } from './_lib/weather.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { location } = req.query;
  if (!location) {
    return res.status(400).json({ error: 'Missing location parameter' });
  }

  // How many days to return (1-7). Defaults to 3 so the existing frontend
  // is unaffected; the digest passes ?days=7 for the weekly snapshot.
  try {
    const result = await getForecast(location, req.query.days);
    res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=600');
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
