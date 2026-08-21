export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const username = process.env.TURN_USERNAME || '';
  const credential = process.env.TURN_CREDENTIAL || '';
  const urls = (process.env.TURN_URLS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  if (username && credential && urls.length) {
    iceServers.push({ urls, username, credential });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ iceServers, turnEnabled: iceServers.length > 2 });
}
