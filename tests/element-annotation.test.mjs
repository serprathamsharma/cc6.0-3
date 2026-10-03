import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAnalysis } from '../src/lib/analysis.js';
import { normalizedRegion, validateManualAnnotation, elementsForAsset } from '../src/lib/evidence.js';
import { createSandbox } from '../src/lib/sandbox.js';
import { verifyEvidence } from '../src/lib/reports.js';
import { appendLedger, verifyLedger } from '../src/lib/provenance.js';

const annotation = { label: 'Erosion Gully', category: 'Terrain Risk', confidence: 1,
  region: { left: .1, top: .2, width: .3, height: .4 },
  observation: 'A groove is visible in the soil.', interpretation: 'Concentrated runoff may have eroded this area.' };

test('manual annotations strictly satisfy the shared visual analysis schema', () => {
  assert.equal(validateManualAnnotation(annotation), true);
  assert.equal(validateAnalysis({ observations: [annotation] }), true);
  for (const invalid of [
    { ...annotation, observation: '' }, { ...annotation, interpretation: undefined },
    { ...annotation, region: { ...annotation.region, width: 1 } },
    { ...annotation, region: { ...annotation.region, top: -.1 } },
    { ...annotation, region: { ...annotation.region, height: 0 } },
    { ...annotation, mergedNarrative: 'Observation and interpretation mixed' }
  ]) assert.equal(validateManualAnnotation(invalid), false);
});

test('dragging in any direction produces normalized clamped image coordinates', () => {
  const region = normalizedRegion({ x: .8, y: .9 }, { x: -.2, y: .2 });
  assert.equal(region.left, 0);
  assert.equal(region.top, .2);
  assert.equal(region.width, .8);
  assert.ok(Math.abs(region.height - .7) < 1e-10);
  assert.equal(validateManualAnnotation({ ...annotation, region }), true);
});

test('manual annotations append atomically and retain source assets and separate facts', async () => {
  const sandbox = createSandbox();
  const asset = { id: 'manual-source', name: 'field.jpg', status: 'ORIGINAL', image: 'https://example.test/field.jpg' };
  await Promise.all([sandbox.annotate(asset, annotation), sandbox.annotate(asset, { ...annotation, label: 'Second gully' })]);
  const snapshot = sandbox.snapshot();
  const saved = snapshot.assets[0];
  assert.equal(saved.image, asset.image);
  assert.equal(saved.status, 'ORIGINAL');
  assert.equal(saved.manualAnnotations.length, 2);
  assert.equal(snapshot.ledger.filter(entry => entry.type === 'MANUAL_ANNOTATION').length, 2);
  assert.equal((await sandbox.provenance()).verification.valid, true);
  const elements = elementsForAsset(saved);
  assert.equal(elements[0].source, 'MANUAL');
  assert.equal(elements[0].observation, annotation.observation);
  assert.equal(elements[0].interpretation, annotation.interpretation);
  assert.equal(elements[0].region.width, 30);
  assert.equal(asset.manualAnnotations, undefined);
});

test('annotation persistence is transactional and tampering is detected after reload', async () => {
  let saved;
  let full = false;
  const storage = { getItem: () => saved, setItem: (key, value) => { if (full) throw new Error('Quota exceeded'); saved = value; } };
  const sandbox = createSandbox(storage);
  const asset = { id: 'source', status: 'ORIGINAL', secureUrl: 'https://example.test/source.png' };
  await sandbox.annotate(asset, annotation);
  full = true;
  await assert.rejects(sandbox.annotate(asset, { ...annotation, label: 'Unsaved' }), /not saved/);
  assert.equal(sandbox.snapshot().assets[0].manualAnnotations.length, 1);
  const reloaded = createSandbox(storage);
  assert.deepEqual(reloaded.snapshot(), sandbox.snapshot());
  const changed = reloaded.snapshot();
  changed.assets[0].manualAnnotations[0].observation = 'Altered after signing';
  assert.match((await verifyEvidence(changed)).reason, /Annotation differs/);
});

test('invalid or empty model output does not replace evidence with demo detections', () => {
  const asset = { id: 'asset_00123', demo: true, analysis: { observations: [] }, manualAnnotations: [{ ...annotation, id: 'manual', source: 'MANUAL' }] };
  assert.deepEqual(elementsForAsset(asset).map(element => element.source), ['MANUAL']);
  asset.analysis = { observations: [{ label: 'Malformed model result' }] };
  assert.deepEqual(elementsForAsset(asset).map(element => element.source), ['MANUAL']);
});

test('annotation edits and deletions retain append-only proofs and survive browser reload', async () => {
  let persisted;
  const storage = { getItem: () => persisted, setItem: (key, value) => { persisted = value; } };
  const sandbox = createSandbox(storage);
  const { asset } = await sandbox.request('/upload', { method: 'POST', body: { image: 'https://example.test/field.png', name: 'field.png' } });
  const created = await sandbox.request('/annotations', { method: 'POST', body: { assetId: asset.id, annotation } });
  const oldLedger = sandbox.snapshot().ledger;
  const region = { left: 0.1234567890123, top: 0.2345678901234, width: 0.3456789012345, height: 0.4567890123456 };
  const edited = await sandbox.request('/annotations', { method: 'PATCH', body: {
    assetId: asset.id, annotationId: created.annotation.id, expectedRevision: 1,
    annotation: { ...annotation, label: 'Revised gully', confidence: 0, region }
  } });
  assert.equal(edited.annotation.id, created.annotation.id);
  assert.equal(edited.annotation.createdAt, created.annotation.createdAt);
  assert.equal(edited.annotation.revision, 2);
  assert.equal(edited.annotation.confidence, 0);
  assert.deepEqual(edited.annotation.region, region);
  assert.equal(edited.asset.secureUrl, asset.secureUrl);
  assert.equal(edited.asset.status, 'ORIGINAL');
  const updated = sandbox.snapshot();
  assert.deepEqual(updated.ledger.slice(0, oldLedger.length), oldLedger);
  assert.equal(updated.ledger.at(-2).type, 'RETRACT_ANNOTATION');
  assert.equal(updated.ledger.at(-2).reason, 'updated');
  assert.deepEqual(updated.ledger.at(-2).annotation, created.annotation);
  assert.equal((await verifyEvidence(updated)).valid, true);
  const reloaded = createSandbox(storage);
  assert.deepEqual(reloaded.snapshot(), updated);
  const removed = await reloaded.request('/annotations', { method: 'DELETE', body: { assetId: asset.id, annotationId: created.annotation.id, expectedRevision: 2 } });
  assert.deepEqual(removed.asset.manualAnnotations, []);
  assert.equal(removed.annotation, null);
  const deleted = reloaded.snapshot();
  assert.equal(deleted.ledger.at(-1).reason, 'deleted');
  assert.deepEqual(deleted.ledger.at(-1).annotation, edited.annotation);
  assert.equal((await verifyEvidence(deleted)).valid, true);
  assert.deepEqual(createSandbox(storage).snapshot(), deleted);
  assert.equal(elementsForAsset(removed.asset).length, 0);
  deleted.assets[0].manualAnnotations.push(edited.annotation);
  assert.match((await verifyEvidence(deleted)).reason, /Retracted annotation is still active/);
});

test('invalid, stale, and failed annotation changes leave both records and proofs untouched', async () => {
  let full = false;
  const sandbox = createSandbox({ getItem: () => null, setItem: () => { if (full) throw new Error('Full'); } });
  const asset = { id: 'original', status: 'ORIGINAL', secureUrl: 'https://example.test/field.jpg' };
  const created = await sandbox.annotate(asset, annotation);
  const input = { assetId: asset.id, annotationId: created.annotation.id, annotation, expectedRevision: 1 };
  const before = sandbox.snapshot();
  await assert.rejects(sandbox.changeAnnotation({ ...input, annotation: { ...annotation, interpretation: '' } }, 'update'), { status: 400 });
  await assert.rejects(sandbox.changeAnnotation({ ...input, annotationId: 'ai-region' }, 'delete'), { status: 404 });
  full = true;
  await assert.rejects(sandbox.changeAnnotation(input, 'update'), /not saved/);
  assert.deepEqual(sandbox.snapshot(), before);
  full = false;
  const results = await Promise.allSettled([sandbox.changeAnnotation(input, 'update'), sandbox.changeAnnotation(input, 'update')]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.status, 409);
  assert.equal((await sandbox.provenance()).verification.valid, true);
  const after = sandbox.snapshot();
  await assert.rejects(sandbox.changeAnnotation(input, 'delete'), { status: 409 });
  assert.deepEqual(sandbox.snapshot(), after);
});

test('annotation replay rejects forged retractions even when block hashes are recomputed', async () => {
  const sandbox = createSandbox();
  const asset = { id: 'source', status: 'ORIGINAL', image: 'https://example.test/field.jpg' };
  const created = await sandbox.annotate(asset, annotation);
  const db = sandbox.snapshot();
  db.ledger = await appendLedger(db.ledger, {
    type: 'RETRACT_ANNOTATION', assetId: asset.id, annotationId: created.annotation.id,
    annotation: { ...created.annotation, observation: 'Unrecorded substitute' }, reason: 'deleted'
  });
  db.assets[0].manualAnnotations = [];
  assert.equal((await verifyLedger(db.ledger)).valid, true);
  assert.match((await verifyEvidence(db)).reason, /retraction differs/);
});
