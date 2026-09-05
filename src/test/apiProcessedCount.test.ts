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
    expect(res.bodyData).toEqual({ error: 'No valid completion events' });
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
});
