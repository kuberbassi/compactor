# Persistent processed-file counter

The hero counter does not use simulated activity. The persistent counter is
initialized once at 4,806,745, the owner-provided estimate of completions before the
backend existed. The Redis `SET NX` migration cannot overwrite or reset an
existing total.

For a deployment-independent global count, connect an Upstash Redis database
to the Vercel project and provide either:

```text
KV_REST_API_URL
KV_REST_API_TOKEN
```

or:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

The production endpoint uses atomic increments, unique completion-event IDs,
and per-IP rate limiting. When the datastore is unavailable, the UI explicitly
labels the fallback count as on-device.

To include localhost activity in the same production total, add this to
`.env.local`:

```text
VITE_PROCESSED_COUNT_API_URL=https://your-production-domain.example/api/processed-count
```

The API permits the standard Vite localhost origins. Add other trusted origins
through the server-side `COUNTER_ALLOWED_ORIGINS` variable.

If a more accurate audited historical total becomes available, update the
Redis key `compactor:processed-files:v1` once through the provider console.
