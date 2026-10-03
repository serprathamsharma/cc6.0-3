import test from 'node:test';
import assert from 'node:assert/strict';
import { buildManifest } from '../server/reports.mjs';
import { appendLedger, verifyLedger } from '../src/lib/provenance.js';
import { demoAssets } from '../src/data/demo.js';

test('empty and unmatched reports never invent evidence or verified claims', async () => {
  for (const input of [{}, { assetIds: [] }, { assetIds: ['missing'] }]) {
    const manifest = await buildManifest({ assets: [], ledger: [] }, input);
    assert.deepEqual(manifest.assets, []);
    assert.deepEqual(manifest.claims, []);
    assert.deepEqual(manifest.provenance.registeredAssetIds, []);
  }
});

test('unregistered fixtures remain explicitly illustrative in exported reports', async () => {
  const manifest = await buildManifest({ assets: [], ledger: [] }, { assetIds: [demoAssets[0].id] });
  assert.equal(manifest.mode, 'demo');
  assert.equal(manifest.assets[0].demo, true);
  assert.deepEqual(manifest.provenance.unregisteredAssetIds, [demoAssets[0].id]);
  assert.deepEqual(manifest.provenance.registeredAssetIds, []);
});

test('manifest includes original/derivative links and a independently verifiable complete chain', async () => {
  const assets = [
    { id: 'original', status: 'ORIGINAL' },
    { id: 'crop', status: 'DERIVATIVE', parentAsset: 'original', parentAssetId: 'original', transformation: 'c_crop,w_200,h_100' },
    { id: 'unrelated', status: 'ORIGINAL' }
  ];
  let ledger = [];
  for (const asset of assets) ledger = await appendLedger(ledger, { type: asset.status, assetId: asset.id });
  for (const selected of ['original', 'crop']) {
    const manifest = await buildManifest({ assets, ledger }, { assetIds: [selected] });
    assert.deepEqual(new Set(manifest.assets.map(asset => asset.id)), new Set(['original', 'crop']));
    assert.equal(manifest.assets.find(asset => asset.id === 'crop').transformation, assets[1].transformation);
    assert.deepEqual(await verifyLedger(manifest.provenance.ledger), { valid: true });
    assert.equal(manifest.provenance.ledger.length, 3);
    assert.deepEqual(manifest.provenance.unregisteredAssetIds, []);
  }
});
