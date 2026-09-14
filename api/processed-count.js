const COUNT_KEY = 'compactor:processed-files:v1';
const EVENT_PREFIX = 'compactor:processed-event:';
const RATE_PREFIX = 'compactor:processed-rate:';
const MAX_EVENTS_PER_REQUEST = 25;
const MAX_EVENTS_PER_IP_PER_HOUR = 250;
// Owner-provided estimate for completions before the persistent counter existed.
// SET NX ensures this is applied once only and never resets an existing count.
const INITIAL_MIGRATION_COUNT = 4_806_745;

const redisConfig = () => ({
  url: process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function redis(command) {
  const { url, token } = redisConfig();
  if (!url || !token) throw new Error('Persistent counter datastore is not configured');
  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(command.map(arg => String(arg))),
    signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined,
  });
  if (!response.ok) throw new Error(`Redis request failed (${response.status})`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error);
  return payload.result;
}

async function getPersistentCount() {
  await redis(['SET', COUNT_KEY, INITIAL_MIGRATION_COUNT.toString(), 'NX']);
  const rawCount = await redis(['GET', COUNT_KEY]);
  return Number.parseInt(rawCount || '0', 10);
}

const allowedOrigins = (request) => {
  const host = request.headers?.host ? `https://${request.headers.host}` : '';
  return new Set([
    host,
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    ...(process.env.COUNTER_ALLOWED_ORIGINS || '').split(',').map(origin => origin.trim()),
  ].filter(Boolean));
};

const applyCors = (request, response) => {
  const origin = request.headers?.origin;
  if (origin && allowedOrigins(request).has(origin)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Vary', 'Origin');
  }
};

const getClientIp = (request) => {
  const forwarded = request.headers?.['x-forwarded-for'];
  return (Array.isArray(forwarded) ? forwarded[0] : forwarded || request.socket?.remoteAddress || 'unknown')
    .split(',')[0]
    .trim()
    .replace(/[^a-fA-F0-9:.-]/g, '')
    .slice(0, 64);
};

export default async function handler(request, response) {
  applyCors(request, response);
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Type', 'application/json');

  if (request.method === 'OPTIONS') return response.status(204).end();

  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST, OPTIONS');
    return response.status(405).json({ error: 'Method not allowed' });
  }

  try {
    if (request.method === 'GET') {
      return response.status(200).json({ count: await getPersistentCount() });
    }

    let body = request.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return response.status(400).json({ error: 'Invalid JSON body' });
      }
    } else if (typeof Buffer !== 'undefined' && Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString('utf-8'));
      } catch {
        return response.status(400).json({ error: 'Invalid JSON body' });
      }
    }

    if (!Array.isArray(body?.eventIds) || body.eventIds.length === 0) {
      return response.status(400).json({ error: 'Completion events must be a non-empty array' });
    }
    if (body.eventIds.length > MAX_EVENTS_PER_REQUEST) {
      return response.status(400).json({ error: 'Completion event batch exceeds maximum' });
    }
    if (body.eventIds.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(id))) {
      return response.status(400).json({ error: 'Invalid completion event' });
    }
    const eventIds = [...new Set(body.eventIds)];

    const hourBucket = Math.floor(Date.now() / 3_600_000);
    const rateKey = `${RATE_PREFIX}${getClientIp(request)}:${hourBucket}`;
    const rateCount = Number(await redis(['INCRBY', rateKey, eventIds.length.toString()]));
    if (rateCount === eventIds.length) await redis(['EXPIRE', rateKey, '3700']);
    if (rateCount > MAX_EVENTS_PER_IP_PER_HOUR) {
      return response.status(429).json({ error: 'Metric rate limit exceeded' });
    }

    let accepted = 0;
    for (const eventId of eventIds) {
      const stored = await redis(['SET', `${EVENT_PREFIX}${eventId}`, '1', 'NX', 'EX', '2592000']);
      if (stored === 'OK') accepted += 1;
    }
    await redis(['SET', COUNT_KEY, INITIAL_MIGRATION_COUNT.toString(), 'NX']);
    const rawCount = accepted > 0
      ? await redis(['INCRBY', COUNT_KEY, accepted.toString()])
      : await redis(['GET', COUNT_KEY]);
    return response.status(200).json({ count: Number.parseInt(rawCount || '0', 10), accepted });
  } catch {
    console.error('Processed count unavailable');
    return response.status(503).json({ error: 'Persistent counter unavailable' });
  }
}
