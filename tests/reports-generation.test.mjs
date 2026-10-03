import test from 'node:test';
import assert from 'node:assert/strict';
import { buildManifest } from '../server/reports.mjs';
import { appendLedger, verifyLedger } from '../src/lib/provenance.js';
import { summarizeReport, verifyEvidence, verifyManifestSignature } from '../src/lib/reports.js';
import { createSandbox } from '../src/lib/sandbox.js';
import { demoAssets } from '../src/data/demo.js';

async function tree() {
  const assets = [{ id: 'source', status: 'ORIGINAL' }, { id: 'unrelated', status: 'ORIGINAL' }];
  for (const [id, parentAssetId] of [['focus', 'source'], ['sharpen', 'focus'], ['isolate', 'source'], ['final', 'sharpen']]) {
    assets.push({ id, parentAssetId, parentAsset: parentAssetId, status: 'DERIVATIVE', tag: 'DERIVATIVE', transformation: `transform-${id}`, description: `Transform ${id}` });
  }
  let ledger = [];
  for (const asset of assets) ledger = await appendLedger(ledger, { type: asset.status, assetId: asset.id, ...(asset.parentAssetId ? { parentAssetId: asset.parentAssetId, parentAsset: asset.parentAsset, transformation: asset.transformation, description: asset.description } : {}) });
  return { assets, ledger, claims: [] };
}

test('complex derivative trees bundle selected descendants and all ancestors without unrelated branches', async () => {
  const db = await tree();
  for (const [selection, expected] of [
    ['source', ['source', 'focus', 'sharpen', 'isolate', 'final']],
    ['focus', ['source', 'focus', 'sharpen', 'final']],
    ['final', ['source', 'focus', 'sharpen', 'final']]
  ]) {
    const manifest = await buildManifest(db, { assetIds: [selection] });
    assert.deepEqual(new Set(manifest.assets.map(asset => asset.id)), new Set(expected));
    assert.equal(manifest.provenance.valid, true);
    assert.deepEqual(await verifyLedger(manifest.provenance.ledger), { valid: true });
  }
});

test('batch manifest exports only the explicit selection when includeRelated is false', async () => {
  const manifest = await buildManifest(await tree(), { assetIds: ['sharpen', 'isolate'], includeRelated: false });
  assert.deepEqual(manifest.assets.map(asset => asset.id), ['sharpen', 'isolate']);
  assert.equal(manifest.assets[0].parentAssetId, 'focus');
  assert.equal(manifest.provenance.valid, true);
});

test('claims linking nonexistent IDs are rejected even outside the selected asset pack', async () => {
  const db = await tree();
  await assert.rejects(buildManifest(db, { assetIds: ['source'], claims: [{ statement: 'Unsupported claim', status: 'VERIFIED', assetIds: ['missing'] }] }), /nonexistent/);
  db.claims = [{ statement: 'Unsupported claim', status: 'PENDING REVIEW', assetIds: ['missing'] }];
  await assert.rejects(buildManifest(db), /nonexistent/);
});

test('tampering with a derivative parentAssetId invalidates report provenance even if hashes are intact', async () => {
  const db = await tree();
  db.assets.find(asset => asset.id === 'focus').parentAssetId = 'unrelated';
  assert.deepEqual(await verifyLedger(db.ledger), { valid: true });
  const manifest = await buildManifest(db);
  assert.equal(manifest.provenance.valid, false);
  assert.equal(manifest.provenance.assetId, 'focus');
  assert.match(manifest.provenance.reason, /parentAssetId/);
});

test('altered parent link in ledger fails verification and changed descriptions are detected', async () => {
  const db = await tree();
  db.ledger[2].parentAssetId = 'unrelated';
  assert.equal((await buildManifest(db)).provenance.valid, false);
  const another = await tree();
  another.assets.find(asset => asset.id === 'focus').description = 'Unrecorded edit';
  assert.equal((await buildManifest(another)).provenance.valid, false);
});

test('report signatures survive JSON export and reject changed claims, evidence, or metrics', async () => {
  const db = await tree();
  db.claims = [{ id: 'claim-1', statement: 'A region is visible.', status: 'PENDING REVIEW', assetIds: ['source', 'unrelated'] }];
  const manifest = JSON.parse(JSON.stringify(await buildManifest(db, { assetIds: ['source'] })));
  assert.deepEqual(manifest.claims[0].missingFromPack, ['unrelated']);
  assert.equal(manifest.summary.pendingClaims, 1);
  assert.equal(manifest.summary.derivatives, 4);
  assert.equal(await verifyManifestSignature(manifest), true);
  for (const alter of [pack => { pack.claims[0].status = 'VERIFIED'; }, pack => { pack.assets[0].name = 'replacement'; }, pack => { pack.summary.assets = 99; }]) {
    const changed = structuredClone(manifest); alter(changed);
    assert.equal(await verifyManifestSignature(changed), false);
  }
});

test('sandbox claims survive reload, retain demo labels, and remain sandbox-scoped in exports', async () => {
  let saved;
  const storage = { getItem: () => saved, setItem: (key, value) => { saved = value; } };
  const first = createSandbox(storage);
  const { claim } = await first.request('/claims', { method: 'POST', body: { statement: 'Illustrative solar arrays.', status: 'PENDING REVIEW', assetIds: [demoAssets[0].id] } });
  const reloaded = createSandbox(storage);
  assert.deepEqual((await reloaded.request('/claims')).claims, [claim]);
  await reloaded.request('/claims', { method: 'POST', body: { ...claim, status: 'CONFLICTED' } });
  const { manifest } = await reloaded.request('/reports/export', { method: 'POST', body: { assetIds: [demoAssets[0].id] } });
  assert.equal(manifest.mode, 'sandbox');
  assert.equal(manifest.assets[0].demo, true);
  assert.equal(manifest.claims[0].status, 'CONFLICTED');
  assert.equal(manifest.provenance.valid, true);
  assert.match(manifest.provenance.scope, /Local sandbox/);
  assert.equal(await verifyManifestSignature(manifest), true);
  const changed = reloaded.snapshot();
  changed.claims[0].statement = 'Unrecorded claim change';
  assert.match((await verifyEvidence(changed)).reason, /Claim differs/);
});

test('report summary distinguishes original, derivative, AI-generated and illustrative evidence', () => {
  const summary = summarizeReport([
    { id: 'original', status: 'ORIGINAL' },
    { id: 'crop', status: 'DERIVATIVE', parentAsset: 'original' },
    { id: 'generated', status: 'AI-GENERATED', parentAsset: 'original' },
    demoAssets[0]
  ]);
  assert.equal(summary.originals, 2);
  assert.equal(summary.derivatives, 1);
  assert.equal(summary.aiGenerated, 1);
  assert.equal(summary.illustrativeAssets, 1);
  assert.equal(summary.verifiedClaims, 0);
});
