import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

test('Cloudinary derivative chains use the immutable source and compose exact parent transformations', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'impactlens-transform-test-'));
  const env = { IMPACTLENS_DATA_DIR: directory, CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: 'test-secret', OPENAI_API_KEY: '', MOCK_VISION: '' };
  const previous = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
  Object.assign(process.env, env);
  t.after(async () => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    await rm(directory, { recursive: true, force: true });
  });
  const { handler } = await import('../server.mjs');
  const server = http.createServer(handler).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  // Register a resource and inspect generated URLs; no provider network calls.
  const request = async (route, body) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${route}`, {
      method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, data: await response.json() };
  };
  const original = (await request('/assets', { publicId: 'impactlens/originals/field', secureUrl: 'https://res.cloudinary.com/test-cloud/image/upload/impactlens/originals/field' })).data.asset;
  const first = (await request('/derivatives', { parentAssetId: original.id, transformation: 'c_crop,w_0.5,h_0.5', description: 'Crop the top-left half.', type: 'focus' })).data;
  const second = (await request('/derivatives', { parentAssetId: first.id, transformation: 'e_contrast:40/e_sharpen:80', description: 'Contrast 40, sharpening 80.', type: 'compare' })).data;
  assert.equal(first.mode, 'cloudinary');
  assert.equal(second.mode, 'cloudinary');
  assert.equal(second.parentAsset, first.id);
  assert.equal(second.transformation, 'e_contrast:40/e_sharpen:80');
  assert.ok(second.secureUrl.includes('/c_crop,w_0.5,h_0.5/e_contrast:40/e_sharpen:80/'));
  assert.ok(new URL(second.secureUrl).pathname.endsWith('/impactlens/originals/field'));
  assert.equal((await request('/derivatives', { parentAssetId: original.id, transformation: 'e_gen_remove:prompt_tree' })).status, 422);
  const assets = (await request('/assets')).data.assets;
  assert.deepEqual(assets.find(asset => asset.id === original.id), original);
  assert.equal((await request('/provenance/verify')).data.valid, true);
});
