import { beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error backend JS handler lacks TS declarations in frontend tsconfig
import handler from '../../api/processed-count.js';

interface MockResponse {
  statusCode: number;
  headers: Record<string, string>;
  bodyData: any;
  status(code: number): MockResponse;
  json(data: any): MockResponse;
  setHeader(name: string, value: string): MockResponse;
  end(): MockResponse;
}

const createMockResponse = (): MockResponse => {
  const res: MockResponse = {
    statusCode: 200,
    headers: {},
    bodyData: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(data: any) {
      this.bodyData = data;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    end() {
      return this;
    },
  };
  return res;
};

describe('api/processed-count backend handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.KV_REST_API_URL = 'https://fake-redis.upstash.io';
    process.env.KV_REST_API_TOKEN = 'fake-token';
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('rejects unsupported HTTP methods with 405 Method Not Allowed', async () => {
    const req = { method: 'DELETE', headers: {} } as any;
    const res = createMockResponse();

    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(res.bodyData).toEqual({ error: 'Method not allowed' });
    expect(res.headers['Allow']).toBe('GET, POST, OPTIONS');
  });

  it('handles OPTIONS preflight with 204 status', async () => {
    const req = { method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } } as any;
    const res = createMockResponse();

    await handler(req, res);
    expect(res.statusCode).toBe(204);
    expect(res.headers['Access-Control-Allow-Origin']).toBe('http://localhost:5173');
  });

  it('returns persistent count on GET request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ result: '4806745' }),
    }));

    const req = { method: 'GET', headers: {} } as any;
    const res = createMockResponse();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.bodyData).toEqual({ count: 4806745 });
  });

  it('returns 503 when Redis datastore is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Connection timeout')));

    const req = { method: 'GET', headers: {} } as any;
    const res = createMockResponse();

    await handler(req, res);
    expect(res.statusCode).toBe(503);
    expect(res.bodyData).toEqual({ error: 'Persistent counter unavailable' });
  });

  it('validates eventIds on POST and rejects empty payloads with 400', async () => {
    const req = { method: 'POST', headers: {}, body: { eventIds: [] } } as any;
    const res = createMockResponse();

    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.bodyData).toEqual({ error: 'Completion events must be a non-empty array' });
  });

  it('rejects malformed and mixed-validity arrays instead of filtering them', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    for (const eventIds of ['not-an-array', ['event-1234567890-abcdefgh', 'bad']]) {
      const res = createMockResponse();
      await handler({ method: 'POST', headers: {}, body: { eventIds } } as any, res);
      expect(res.statusCode).toBe(400);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects batches above the maximum instead of truncating them', async () => {
    const res = createMockResponse();
    const eventIds = Array.from({ length: 26 }, (_, index) => `event-${index.toString().padStart(16, '0')}`);
    await handler({ method: 'POST', headers: {}, body: { eventIds } } as any, res);
    expect(res.statusCode).toBe(400);
    expect(res.bodyData).toEqual({ error: 'Completion event batch exceeds maximum' });
  });

  it('safely parses stringified JSON bodies on POST', async () => {
    const calls: any[] = [];
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url, opts) => {
      const cmd = JSON.parse(opts.body);
      calls.push(cmd);
      if (cmd[0] === 'INCRBY' && cmd[1].includes('compactor:processed-rate')) {
        return { ok: true, json: async () => ({ result: 1 }) };
      }
      if (cmd[0] === 'SET' && cmd[1].includes('compactor:processed-event')) {
        return { ok: true, json: async () => ({ result: 'OK' }) };
      }
      if (cmd[0] === 'INCRBY' && cmd[1] === 'compactor:processed-files:v1') {
        return { ok: true, json: async () => ({ result: '4806746' }) };
      }
      return { ok: true, json: async () => ({ result: 'OK' }) };
    }));

    const validId = 'event-1234567890-abcdefgh';
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: JSON.stringify({ eventIds: [validId] }),
    } as any;
    const res = createMockResponse();

    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.bodyData).toEqual({ count: 4806746, accepted: 1 });
  });

  it('enforces rate limits with 429 when hourly limit exceeded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url, opts) => {
      const cmd = JSON.parse(opts.body);
      if (cmd[0] === 'INCRBY' && cmd[1].includes('compactor:processed-rate')) {
        return { ok: true, json: async () => ({ result: 251 }) }; // Exceeds MAX_EVENTS_PER_IP_PER_HOUR (250)
      }
      return { ok: true, json: async () => ({ result: 'OK' }) };
    }));

    const validId = 'event-1234567890-abcdefgh';
    const req = {
      method: 'POST',
      headers: { 'x-forwarded-for': '127.0.0.1' },
      body: { eventIds: [validId] },
    } as any;
    const res = createMockResponse();

    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(res.bodyData).toEqual({ error: 'Metric rate limit exceeded' });
  });

  it('accepts the maximum batch and ignores replayed completion IDs', async () => {
    let count = 4_806_745;
    let rate = 0;
    const seen = new Set<string>();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url, opts) => {
      const command = JSON.parse(opts.body) as string[];
      let result: string | number | null = 'OK';
      if (command[0] === 'INCRBY' && command[1].includes('processed-rate')) result = rate += Number(command[2]);
      else if (command[0] === 'SET' && command[1].includes('processed-event')) {
        if (seen.has(command[1])) result = null;
        else seen.add(command[1]);
      } else if (command[0] === 'INCRBY' && command[1] === 'compactor:processed-files:v1') result = count += Number(command[2]);
      else if (command[0] === 'GET') result = count.toString();
      return { ok: true, json: async () => ({ result }) };
    }));

    const eventIds = Array.from({ length: 25 }, (_, index) => `event-${index.toString().padStart(16, '0')}`);
    const first = createMockResponse();
    await handler({ method: 'POST', headers: {}, body: { eventIds } } as any, first);
    expect(first.bodyData).toEqual({ count: 4_806_770, accepted: 25 });

    const replay = createMockResponse();
    await handler({ method: 'POST', headers: {}, body: { eventIds: [eventIds[0]] } } as any, replay);
    expect(replay.bodyData).toEqual({ count: 4_806_770, accepted: 0 });
  });

  it('allows requests that reach, but do not exceed, the hourly maximum', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async (_url, opts) => {
      const command = JSON.parse(opts.body) as string[];
      if (command[0] === 'INCRBY' && command[1].includes('processed-rate')) return { ok: true, json: async () => ({ result: 250 }) };
      if (command[0] === 'SET' && command[1].includes('processed-event')) return { ok: true, json: async () => ({ result: 'OK' }) };
      if (command[0] === 'INCRBY') return { ok: true, json: async () => ({ result: '4806770' }) };
      return { ok: true, json: async () => ({ result: 'OK' }) };
    }));
    const eventIds = Array.from({ length: 25 }, (_, index) => `event-${index.toString().padStart(16, '0')}`);
    const res = createMockResponse();
    await handler({ method: 'POST', headers: {}, body: { eventIds } } as any, res);
    expect(res.statusCode).toBe(200);
    expect(res.bodyData.accepted).toBe(25);
  });
});

describe('processed counter client fallback', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
    vi.stubEnv('VITE_PROCESSED_COUNT_API_URL', 'https://counter.example.test');
  });

  it('keeps successful processing independent of an offline counter API', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { recordProcessedFiles } = await import('../utils/counterStorage');
    await expect(recordProcessedFiles(2)).resolves.toEqual({ count: 2, scope: 'device' });
    expect(localStorage.getItem('compactor_processed_on_device_v1')).toBe('2');
  });

  it('falls back to the device count when the API returns a failure response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    const { getProcessedCount } = await import('../utils/counterStorage');
    await expect(getProcessedCount()).resolves.toEqual({ count: 0, scope: 'device' });
  });

  it('bounds pending anonymous events while the counter stays offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const { recordProcessedFiles } = await import('../utils/counterStorage');
    for (let attempt = 0; attempt < 5; attempt += 1) await recordProcessedFiles(25);
    const pending = JSON.parse(localStorage.getItem('compactor_pending_metric_events_v1') || '[]') as string[];
    expect(pending).toHaveLength(100);
    expect(pending.every(eventId => /^[a-zA-Z0-9-]{16,80}$/.test(eventId))).toBe(true);
  });
});
