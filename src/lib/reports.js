import { demoAssets } from '../data/demo.js';
import { sha256, verifyLedger } from './provenance.js';
import { elementsForAsset, validateClaim } from './evidence.js';

export function filterClaims(claims, { status = 'all', query = '' } = {}) {
  const term = query.trim().toLowerCase();
  return claims.filter(claim => (status === 'all' || claim.status === status)
    && (!term || claim.statement.toLowerCase().includes(term) || claim.assetIds.some(id => id.toLowerCase().includes(term))));
}

export function summarizeReport(assets, claims = []) {
  return {
    assets: assets.length,
    originals: assets.filter(asset => asset.status === 'ORIGINAL').length,
    derivatives: assets.filter(asset => asset.status === 'DERIVATIVE').length,
    aiGenerated: assets.filter(asset => asset.status === 'AI-GENERATED').length,
    illustrativeAssets: assets.filter(asset => asset.demo).length,
    elements: assets.reduce((total, asset) => total + elementsForAsset(asset).length, 0),
    manualAnnotations: assets.reduce((total, asset) => total + (asset.manualAnnotations?.length || 0), 0),
    claims: claims.length,
    verifiedClaims: claims.filter(claim => claim.status === 'VERIFIED').length,
    pendingClaims: claims.filter(claim => claim.status === 'PENDING REVIEW').length,
    conflictedClaims: claims.filter(claim => claim.status === 'CONFLICTED').length
  };
}

export async function verifyManifestSignature(manifest) {
  const { signature, ...payload } = manifest;
  return signature?.algorithm === 'SHA-256' && signature.digest === await sha256(JSON.stringify(payload));
}

export async function verifyEvidence(db) {
  const verification = await verifyLedger(db.ledger);
  if (!verification.valid) return verification;
  const latestAnalysis = new Map();
  const latestClaim = new Map();
  const annotationStates = new Map();
  const annotationKey = (assetId, annotationId) => JSON.stringify([assetId, annotationId]);
  for (const entry of db.ledger) {
    if (entry.type === 'ANALYSIS') latestAnalysis.set(entry.assetId, entry);
    if (entry.claimId && entry.claim) latestClaim.set(entry.claimId, entry);
  }
  for (let index = 0; index < db.ledger.length; index++) {
    const entry = db.ledger[index];
    const asset = db.assets.find(item => item.id === entry.assetId);
    const mismatch = reason => ({ valid: false, index: index + 1, assetId: entry.assetId, reason });
    if (entry.type === 'ORIGINAL') {
      if (!asset) return mismatch('Registered source is missing');
      if (entry.sourceReferenceSha256 && await sha256(asset.secureUrl || asset.image || '') !== entry.sourceReferenceSha256) return mismatch('Source reference differs from ledger proof');
      if (entry.originalSha256 && asset.originalSha256 !== entry.originalSha256) return mismatch('Original digest differs from ledger proof');
    }
    if (['DERIVATIVE', 'AI-GENERATED'].includes(entry.type)) {
      for (const key of ['parentAssetId', 'parentAsset', 'transformation', 'description']) {
        if (entry[key] !== undefined && asset?.[key] !== entry[key]) return { valid: false, index: index + 1, assetId: entry.assetId, reason: `${key} differs from ledger proof` };
      }
    }
    if (entry.type === 'MANUAL_ANNOTATION') {
      if (!entry.annotation?.id || entry.annotation.source !== 'MANUAL') return mismatch('Invalid manual annotation proof');
      const key = annotationKey(entry.assetId, entry.annotation.id);
      const previous = annotationStates.get(key);
      if (previous?.active) return mismatch('Annotation revision was not retracted before replacement');
      if (previous && (previous.reason !== 'updated' || entry.annotation.revision !== (previous.annotation.revision || 1) + 1)) return mismatch('Invalid annotation replacement revision');
      annotationStates.set(key, { ...entry, active: true, index: index + 1 });
    }
    if (entry.type === 'RETRACT_ANNOTATION') {
      const key = annotationKey(entry.assetId, entry.annotationId);
      const previous = annotationStates.get(key);
      if (!previous?.active || !['updated', 'deleted'].includes(entry.reason)
        || entry.annotationId !== entry.annotation?.id
        || await sha256(JSON.stringify(previous.annotation)) !== await sha256(JSON.stringify(entry.annotation))) return mismatch('Annotation retraction differs from its active ledger proof');
      annotationStates.set(key, { ...entry, active: false, index: index + 1 });
    }
    if (entry.analysisSha256 && latestAnalysis.get(entry.assetId) === entry && await sha256(JSON.stringify(asset?.analysis || null)) !== entry.analysisSha256) return mismatch('Analysis differs from ledger proof');
    if (entry.claim && latestClaim.get(entry.claimId) === entry) {
      const saved = db.claims?.find(claim => claim.id === entry.claimId);
      if (await sha256(JSON.stringify(saved || null)) !== await sha256(JSON.stringify(entry.claim))) return mismatch('Claim differs from ledger proof');
    }
  }
  // Compare the current collection with replayed active revisions, not retired
  // snapshots. Historical edits/deletions remain fully covered by the hash chain.
  for (const state of annotationStates.values()) {
    const asset = db.assets.find(item => item.id === state.assetId);
    const saved = asset?.manualAnnotations?.filter(item => item.id === state.annotation.id) || [];
    let reason;
    if (state.active && (saved.length !== 1 || await sha256(JSON.stringify(saved[0])) !== await sha256(JSON.stringify(state.annotation)))) reason = 'Annotation differs from ledger proof';
    if (!state.active && (saved.length || state.reason === 'updated')) reason = saved.length ? 'Retracted annotation is still active' : 'Annotation replacement is missing from ledger';
    if (reason) return { valid: false, index: state.index, assetId: state.assetId, reason };
  }
  for (const asset of db.assets) {
    if (asset.manualAnnotations?.some(item => !annotationStates.has(annotationKey(asset.id, item.id)))) {
      return { valid: false, assetId: asset.id, reason: 'Annotation has no ledger proof' };
    }
  }
  return verification;
}

export async function buildManifest(db, input = {}) {
  const available = new Map([...demoAssets, ...db.assets].map(asset => [asset.id, asset]));
  const selected = new Set(input.assetIds || db.assets.map(asset => asset.id));
  // Descendants of the selection, followed by ancestors (without unrelated sibling branches).
  if (input.includeRelated !== false) {
    let changed = true;
    while (changed) {
      changed = false;
      for (const asset of available.values()) {
        const parentId = asset.parentAssetId || asset.parentAsset;
        if (parentId && selected.has(parentId) && !selected.has(asset.id)) { selected.add(asset.id); changed = true; }
      }
    }
    for (const id of selected) {
      const parentId = available.get(id)?.parentAssetId || available.get(id)?.parentAsset;
      if (parentId) selected.add(parentId);
    }
  }
  const assets = [...selected].map(id => available.get(id)).filter(Boolean);
  const claims = (input.claims || db.claims || []).filter(claim => !input.assetIds || claim.assetIds?.some(id => selected.has(id)));
  // Explicit export claims must always be valid, including ones outside a filtered selection.
  for (const claim of input.claims || claims) {
    if (!validateClaim(claim, [...available.values()])) throw Object.assign(new Error('Claim references nonexistent evidence or has invalid fields.'), { status: 400 });
  }
  const registered = new Set(db.ledger.filter(entry => ['ORIGINAL', 'DERIVATIVE', 'AI-GENERATED'].includes(entry.type)).map(entry => entry.assetId));
  const payload = {
    title: input.title || 'ImpactLens Evidence Report', generatedAt: new Date().toISOString(),
    mode: db.mode === 'sandbox' ? 'sandbox' : assets.length && assets.every(asset => asset.demo) ? 'demo' : assets.some(asset => asset.demo) ? 'mixed' : 'evidence',
    summary: summarizeReport(assets, claims),
    claims: claims.map(claim => ({ ...claim, missingFromPack: claim.assetIds.filter(id => !selected.has(id)) })), assets,
    provenance: {
      ...await verifyEvidence(db),
      scope: db.mode === 'sandbox' ? 'Local sandbox ledger only; not synchronized with the server.' : 'Workspace ledger integrity; does not independently verify factual claims or image contents.',
      registeredAssetIds: assets.filter(asset => registered.has(asset.id)).map(asset => asset.id),
      unregisteredAssetIds: assets.filter(asset => !registered.has(asset.id)).map(asset => asset.id),
      ledger: db.ledger
    }
  };
  return { ...payload, signature: { algorithm: 'SHA-256', digest: await sha256(JSON.stringify(payload)), scope: 'JSON.stringify(manifest without signature). Content integrity digest, not an identity signature.' } };
}
