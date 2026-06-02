const config = {
  api: {
    path: '/api/tee_times/config',
    method: 'GET',
    description: 'Tee times configuration endpoint'
  },
  defaults: {
    intervalMinutes: 10,
    maxPlayers: 4,
    bookingWindowDays: 30
  }
};

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

  return res.status(200).json({ data: config });
}
