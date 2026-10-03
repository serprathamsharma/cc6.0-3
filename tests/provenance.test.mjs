import test from 'node:test';
import assert from 'node:assert/strict';
import { appendLedger, buildLedgerCertificate, formatChainDigest, sha256, verifyLedger } from '../src/lib/provenance.js';
import { createHash } from 'node:crypto';

async function evidenceChain() {
  let ledger = await appendLedger([], { type: 'ORIGINAL', assetId: 'asset_00123' });
  return appendLedger(ledger, { type: 'DERIVATIVE', assetId: 'crop', parentAsset: 'asset_00123', transformation: 'c_crop,w_200,h_100' });
}

test('production hash chain verifies and detects modified event data', async () => {
  const ledger = await evidenceChain();
  assert.deepEqual(await verifyLedger(ledger), { valid: true });
  ledger[0].assetId = 'tampered';
  assert.deepEqual(await verifyLedger(ledger), { valid: false, index: 1 });
});

test('changing a stored previousHash invalidates the chain', async () => {
  const ledger = await evidenceChain();
  ledger[1].previousHash = 'forged-link';
  assert.deepEqual(await verifyLedger(ledger), { valid: false, index: 2 });
});

test('removing, reordering or altering transformation events invalidates the chain', async () => {
  const ledger = await evidenceChain();
  assert.deepEqual(await verifyLedger([ledger[1]]), { valid: false, index: 1 });
  assert.deepEqual(await verifyLedger([...ledger].reverse()), { valid: false, index: 1 });
  ledger[1].transformation = 'e_grayscale';
  assert.deepEqual(await verifyLedger(ledger), { valid: false, index: 2 });
});

test('ledger certificates include independently verifiable chain, head and SHA-256 metadata', async () => {
  const ledger = await evidenceChain();
  const certificate = await buildLedgerCertificate({ ledger, verification: { valid: true }, mode: 'server' });
  const { signature, ...payload } = JSON.parse(JSON.stringify(certificate));
  assert.equal(certificate.entryCount, 2);
  assert.equal(certificate.headHash, ledger.at(-1).hash);
  assert.equal(certificate.verification.valid, true);
  assert.deepEqual(await verifyLedger(certificate.ledger), { valid: true });
  assert.equal(signature.digest, createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
  assert.equal(certificate.ledgerDigest, createHash('sha256').update(JSON.stringify(ledger)).digest('hex'));
  assert.match(formatChainDigest(certificate), new RegExp(ledger.at(-1).hash));
  assert.match(formatChainDigest(certificate), /Overall verification: PASSED/);
  ledger[0].assetId = 'later edit';
  assert.equal((await verifyLedger(certificate.ledger)).valid, true, 'Certificate must be an independent snapshot');
  payload.entryCount = 999;
  assert.notEqual(signature.digest, await sha256(JSON.stringify(payload)));
});

test('certificate export recomputes the chain and never disguises failed or missing evidence verification', async () => {
  const ledger = await evidenceChain();
  ledger[1].transformation = 'unrecorded transformation';
  const certificate = await buildLedgerCertificate({ ledger, verification: { valid: true }, mode: 'server' });
  assert.equal(certificate.verification.valid, false);
  assert.deepEqual(certificate.verification.chain, { valid: false, index: 2 });
  assert.match(formatChainDigest(certificate), /Overall verification: FAILED/);
  const missing = await buildLedgerCertificate({ ledger: await evidenceChain(), mode: 'server' });
  assert.equal(missing.verification.valid, false);
  assert.match(formatChainDigest(missing), /Evidence record verification: UNAVAILABLE/);
  const failedEvidence = await buildLedgerCertificate({ ledger: await evidenceChain(), verification: { valid: false, reason: 'Annotation differs' } });
  assert.equal(failedEvidence.verification.chain.valid, true);
  assert.equal(failedEvidence.verification.valid, false);
});

test('empty sandbox certificates explicitly identify GENESIS and browser-only scope', async () => {
  const certificate = await buildLedgerCertificate({ ledger: [], verification: { valid: true }, mode: 'sandbox' });
  assert.equal(certificate.entryCount, 0);
  assert.equal(certificate.headHash, 'GENESIS');
  assert.match(certificate.label, /LOCAL SANDBOX/);
  assert.match(certificate.verification.scope, /Local sandbox only/);
  assert.match(formatChainDigest(certificate), /0 events/);
  assert.equal((await verifyLedger([null])).valid, false);
});
