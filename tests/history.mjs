import assert from 'node:assert/strict';
import worker from '../src/worker.js';

const values = new Map();
const expirations = new Map();
const writes = [];
const env = {
  SUB_ACCESS_TOKEN: 'test-token',
  SUB_STORE: {
    async get(key) { return values.get(key) ?? null; },
    async put(key, value, options) {
      values.set(key, value);
      if (options?.expirationTtl) expirations.set(key, Date.now() + options.expirationTtl * 1000);
      else expirations.delete(key);
      writes.push({ key, options });
    },
    async list({ prefix }) {
      return { keys: [...values.keys()].filter((name) => name.startsWith(prefix)).map((name) => ({
        name,
        ...(expirations.has(name) ? { expiration: expirations.get(name) } : {}),
      })) };
    },
  },
  ASSETS: { fetch() { return new Response('asset'); } },
};

const vmess = 'vmess://' + btoa(JSON.stringify({
  v: '2', ps: 'test', add: 'edge.example.com', port: '443',
  id: '00000000-0000-4000-8000-000000000001', net: 'ws',
  tls: 'tls', host: 'edge.example.com', sni: 'edge.example.com', path: '/ws',
}));

async function generate(ip) {
  const request = new Request('https://example.com/api/generate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nodeLinks: vmess, preferredIps: ip, namePrefix: 'US-Edge' }),
  });
  const response = await worker.fetch(request, env);
  assert.equal(response.status, 200);
  return response.json();
}

const first = await generate('104.16.1.2');
assert.equal(first.counts.outputNodes, 1);
assert.ok(values.has(`sub:${first.shortId}`));
assert.ok(writes.every(({ options }) => options === undefined));

const repeated = await generate('104.16.1.2');
assert.equal(repeated.shortId, first.shortId);
assert.equal(writes.length, 2, 'generating identical content should not rewrite KV keys');

const updated = await generate('104.17.2.3');
assert.notEqual(updated.shortId, first.shortId);
assert.ok(values.has(`sub:${first.shortId}`));
assert.ok(values.has(`sub:${updated.shortId}`));

const oldDedupKey = [...values.keys()].find((key) => key.startsWith('dedup:') && values.get(key) === first.shortId);
expirations.set(oldDedupKey, Date.now() + 86_400_000);
expirations.set(`sub:${first.shortId}`, Date.now() + 86_400_000);
const migrated = await generate('104.16.1.2');
assert.equal(migrated.shortId, first.shortId);
assert.equal(expirations.has(oldDedupKey), false);
assert.equal(expirations.has(`sub:${first.shortId}`), false);

const oldLink = await worker.fetch(new Request(first.urls.raw), env);
assert.equal(oldLink.status, 200);
assert.ok((await oldLink.text()).length > 0);

console.log('history storage test passed');
