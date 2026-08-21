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

  const preferredTurnUrls = [...urls].sort((a, b) => {
    const score = (url) => {
      if (url.startsWith('turns:') && url.includes(':443') && url.includes('transport=tcp')) return 0;
      if (url.startsWith('turn:') && url.includes(':443')) return 1;
      if (url.includes('transport=tcp')) return 2;
      return 3;
    };
    return score(a) - score(b);
  });

  const iceServers = [];

  if (username && credential && preferredTurnUrls.length) {
    iceServers.push({ urls: preferredTurnUrls, username, credential });
  }

  iceServers.push(
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  );

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ iceServers, turnEnabled: Boolean(username && credential && preferredTurnUrls.length) });
}
