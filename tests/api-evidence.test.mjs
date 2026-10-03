import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

test('local API preserves evidence and exposes integration failures honestly', async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'impactlens-api-test-'));
  const envKeys = ['IMPACTLENS_DATA_DIR', 'CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'OPENAI_API_KEY', 'MOCK_VISION'];
  const previousEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
  for (const key of envKeys) process.env[key] = '';
  process.env.IMPACTLENS_DATA_DIR = directory;
  t.after(async () => {
    for (const key of envKeys) {
      if (previousEnv[key] === undefined) delete process.env[key];
      else process.env[key] = previousEnv[key];
    }
    await rm(directory, { recursive: true, force: true });
  });

  const { handler } = await import('../server.mjs');
  const server = http.createServer(handler).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  const request = async (route, body, method = body === undefined ? 'GET' : 'POST') => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api${route}`, {
      method,
      headers: { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return { status: response.status, data: await response.json() };
  };

  const image = 'data:image/png;base64,aW1hZ2UtYnl0ZXM=';
  let original;
  let derivative;
  await t.test('status indicates configuration rather than assumed connectivity', async () => {
    const { data } = await request('/status');
    assert.equal(data.mode, 'local');
    assert.equal(data.ai, false);
    assert.equal(data.capabilities.deliveryTransformations, false);
  });

  await t.test('local upload stores original bytes digest and no invented analysis', async () => {
    const { status, data } = await request('/upload', { image, storage: 'local', name: 'field.png' });
    assert.equal(status, 201);
    original = data.asset;
    assert.equal(original.status, 'ORIGINAL');
    assert.equal(original.storage, 'local');
    assert.equal(original.originalSha256, createHash('sha256').update(Buffer.from('image-bytes')).digest('hex'));
    assert.equal(data.analysis, null);
  });

  await t.test('unavailable analysis and cloud upload do not append false success events', async () => {
    const before = (await request('/provenance')).data.ledger.length;
    assert.equal((await request('/analysis', { assetId: original.id })).status, 503);
    assert.equal((await request('/upload', { image, storage: 'cloudinary' })).status, 503);
    assert.equal((await request('/provenance')).data.ledger.length, before);
    assert.equal((await request('/assets')).data.assets.length, 1);
  });

  await t.test('preview derivatives retain exact transformations and never replace originals', async () => {
    const transformation = 'c_crop,x_10,y_20,w_40,h_50';
    const { status, data } = await request('/derivatives', { parentAssetId: original.id, transformation });
    assert.equal(status, 201);
    derivative = data;
    assert.equal(data.mode, 'preview');
    assert.equal(data.parentAsset, original.id);
    assert.equal(data.parentAssetId, original.id);
    assert.equal(data.transformation, transformation);
    assert.equal(data.secureUrl, original.secureUrl);
    const savedOriginal = (await request('/assets')).data.assets.find(asset => asset.id === original.id);
    assert.deepEqual(savedOriginal, original);
  });

  await t.test('exports include derivatives and preserve empty selections', async () => {
    const { data } = await request('/reports/export', { assetIds: [original.id] });
    assert.deepEqual(data.manifest.claims, []);
    assert.deepEqual(data.manifest.assets.map(asset => asset.id), [original.id, derivative.id]);
    assert.equal(data.manifest.provenance.valid, true);
    assert.deepEqual((await request('/reports/export', { assetIds: [] })).data.manifest.assets, []);
    assert.equal((await request('/reports/export', { assetIds: 'not-an-array' })).status, 400);
  });

  await t.test('concurrent uploads retain every original and a valid chain', async () => {
    const uploaded = await Promise.all(Array.from({ length: 5 }, (_, index) => request('/upload', {
      image, storage: 'local', name: `parallel-${index}.png`
    })));
    const assets = (await request('/assets')).data.assets;
    for (const result of uploaded) {
      assert.equal(result.status, 201);
      assert.ok(assets.some(asset => asset.id === result.data.asset.id), 'Successful uploads must not disappear');
    }
    assert.equal((await request('/provenance/verify')).data.valid, true);
  });

  await t.test('claims reject nonexistent evidence and persist analyst review events', async () => {
    assert.equal((await request('/claims', { statement: 'A visible feature', status: 'PENDING REVIEW', assetIds: ['missing'] })).status, 400);
    const { data, status } = await request('/claims', { statement: 'A visible feature', status: 'PENDING REVIEW', assetIds: [original.id] });
    assert.equal(status, 201);
    assert.equal((await request('/claims')).data.claims[0].id, data.claim.id);
    const manifest = (await request('/reports/export', { assetIds: [original.id] })).data.manifest;
    assert.equal(manifest.claims.length, 1);
    assert.equal(manifest.claims[0].status, 'PENDING REVIEW');
    const reviewed = await request('/claims', { ...data.claim, status: 'VERIFIED' });
    assert.equal(reviewed.status, 201);
    const pack = (await request('/reports/export', { assetIds: [original.id] })).data.manifest;
    assert.equal(pack.summary.verifiedClaims, 1);
    const { signature, ...payload } = pack;
    assert.equal(signature.digest, createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
    const db = JSON.parse(await readFile(path.join(directory, 'impactlens.json'), 'utf8'));
    assert.deepEqual(db.claims, [reviewed.data.claim]);
    assert.equal(db.ledger.at(-1).type, 'CLAIM_REVIEW');
    assert.deepEqual(db.ledger.at(-1).claim, reviewed.data.claim);
  });

  await t.test('concurrent manual annotations persist separate schema-validated facts and events', async () => {
    const annotation = { label: 'Gully', category: 'Terrain', confidence: 1, region: { left: .1, top: .2, width: .3, height: .4 }, observation: 'A groove is visible.', interpretation: 'May indicate runoff erosion.' };
    assert.equal((await request('/annotations', { assetId: original.id, annotation: { ...annotation, interpretation: '' } })).status, 400);
    assert.equal((await request('/annotations', { assetId: derivative.id, annotation })).status, 422);
    const responses = await Promise.all([1, 2, 3].map(() => request('/annotations', { assetId: original.id, annotation })));
    assert.ok(responses.every(response => response.status === 201));
    const saved = (await request('/assets')).data.assets.find(asset => asset.id === original.id);
    assert.equal(saved.manualAnnotations.length, 3);
    assert.equal(saved.secureUrl, original.secureUrl);
    assert.equal(saved.originalSha256, original.originalSha256);
    assert.deepEqual(saved.manualAnnotations[0].region, annotation.region);
    assert.equal(saved.manualAnnotations[0].source, 'MANUAL');
    const proof = (await request('/provenance')).data;
    assert.equal(proof.verification.valid, true);
    assert.equal(proof.ledger.filter(entry => entry.type === 'MANUAL_ANNOTATION').length, 3);
    const db = JSON.parse(await readFile(path.join(directory, 'impactlens.json'), 'utf8'));
    assert.deepEqual(db.assets.find(asset => asset.id === original.id).manualAnnotations, saved.manualAnnotations);
  });

  await t.test('annotation PATCH/DELETE retain revisions, reject stale changes and export valid history', async () => {
    const saved = (await request('/assets')).data.assets.find(asset => asset.id === original.id);
    const previous = saved.manualAnnotations[0];
    const fields = Object.fromEntries(['label', 'category', 'confidence', 'region', 'observation', 'interpretation'].map(key => [key, previous[key]]));
    const input = { assetId: original.id, annotationId: previous.id, expectedRevision: 1, annotation: { ...fields, label: 'Updated terrain channel', confidence: 0 } };
    const before = (await request('/provenance')).data.ledger;
    assert.equal((await request('/annotations', { ...input, annotation: { ...fields, observation: '' } }, 'PATCH')).status, 400);
    assert.equal((await request('/annotations', { ...input, annotationId: 'ai-region' }, 'DELETE')).status, 404);
    const response = await request('/annotations', input, 'PATCH');
    assert.equal(response.status, 200);
    assert.equal(response.data.annotation.revision, 2);
    assert.equal(response.data.annotation.confidence, 0);
    assert.equal(response.data.annotation.id, previous.id);
    assert.equal(response.data.asset.manualAnnotations.length, 3);
    assert.equal(response.data.asset.originalSha256, original.originalSha256);
    assert.equal((await request('/annotations', input, 'PATCH')).status, 409);
    const edited = (await request('/provenance')).data;
    assert.deepEqual(edited.ledger.slice(0, before.length), before);
    assert.equal(edited.ledger.at(-2).type, 'RETRACT_ANNOTATION');
    assert.deepEqual(edited.ledger.at(-2).annotation, previous);
    assert.equal(edited.verification.valid, true);
    const removed = await request('/annotations', { ...input, expectedRevision: 2 }, 'DELETE');
    assert.equal(removed.status, 200);
    assert.equal(removed.data.asset.manualAnnotations.length, 2);
    const { manifest } = (await request('/reports/export', { assetIds: [original.id] })).data;
    assert.equal(manifest.summary.manualAnnotations, 2);
    assert.equal(manifest.provenance.valid, true);
    assert.equal(manifest.provenance.ledger.at(-1).type, 'RETRACT_ANNOTATION');
    const db = JSON.parse(await readFile(path.join(directory, 'impactlens.json'), 'utf8'));
    assert.deepEqual(db.assets.find(asset => asset.id === original.id).manualAnnotations, removed.data.asset.manualAnnotations);
    const options = await fetch(`http://127.0.0.1:${server.address().port}/api/annotations`, { method: 'OPTIONS' });
    assert.match(options.headers.get('access-control-allow-methods'), /PATCH,DELETE/);
  });

  await t.test('API verification detects altered stored chain links', async () => {
    const file = path.join(directory, 'impactlens.json');
    const db = JSON.parse(await readFile(file, 'utf8'));
    db.ledger[1].previousHash = 'tampered-link';
    await writeFile(file, JSON.stringify(db));
    assert.deepEqual((await request('/provenance/verify')).data, { valid: false, index: 2 });
  });
});
