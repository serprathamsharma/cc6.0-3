import { demoAssets } from '../data/demo.js';
import { appendLedger, sha256 } from './provenance.js';
import { buildManifest, verifyEvidence } from './reports.js';
import { simulateAnalysis } from './simulation.js';
import { validateClaim, validateManualAnnotation } from './evidence.js';
import { changeManualAnnotation } from './annotations.js';

export function createSandbox(storage) {
  let db = { assets: [], ledger: [], claims: [] };
  try {
    const saved = JSON.parse(storage?.getItem('impactlens-sandbox-v1') || 'null');
    if (saved && Array.isArray(saved.assets) && Array.isArray(saved.ledger) && Array.isArray(saved.claims)) db = saved;
  } catch { storage = undefined; }
  let pending = Promise.resolve();
  const event = async (state, value) => { state.ledger = await appendLedger(state.ledger, { ...value, timestamp: new Date().toISOString(), sandbox: true, actor: 'local-analyst' }); };
  const update = operation => {
    const result = pending.then(async () => {
      const next = structuredClone(db);
      const value = await operation(next);
      try { storage?.setItem('impactlens-sandbox-v1', JSON.stringify(next)); }
      catch { throw new Error('Sandbox storage is full or unavailable. This change was not saved. Try a smaller image or export your existing work.'); }
      db = next;
      return structuredClone(value);
    });
    pending = result.catch(() => {});
    return result;
  };
  const ensure = async (state, asset) => {
    let saved = state.assets.find(item => item.id === asset.id);
    if (!saved) {
      saved = { ...structuredClone(asset), localOnly: true };
      state.assets.push(saved);
      await event(state, { type: saved.status || 'ORIGINAL', assetId: saved.id, demo: Boolean(saved.demo) });
    }
    return saved;
  };
  const sandbox = {
    snapshot: () => structuredClone(db),
    async provenance() { await pending; return { ledger: structuredClone(db.ledger), verification: await verifyEvidence(db), mode: 'sandbox' }; },
    analyze: asset => update(async state => {
      if (asset.mode === 'preview') throw new Error('Render this derivative before analysis; its preview shows the parent image.');
      const saved = await ensure(state, asset);
      saved.analysis = simulateAnalysis(asset);
      await event(state, { type: 'ANALYSIS', assetId: asset.id, model: saved.analysis.model, analysisSha256: await sha256(JSON.stringify(saved.analysis)), demo: true });
      return saved.analysis;
    }),
    derivative: (asset, input) => update(async state => {
      if (typeof input.transformation !== 'string' || !input.transformation.trim() || !input.description?.trim()) throw new Error('An exact transformation and description are required.');
      if (/\b(?:e_)?gen_[a-z_]+/.test(input.transformation)) throw new Error('Generative transformations are not enabled.');
      await ensure(state, asset);
      const derivative = { ...input, id: `sandbox_derivative_${crypto.randomUUID()}`, parentAsset: asset.id, parentAssetId: asset.id, status: 'DERIVATIVE', tag: 'DERIVATIVE', name: input.label, demo: Boolean(asset.demo), localOnly: true, mode: 'preview', secureUrl: asset.secureUrl || asset.image, createdAt: new Date().toISOString() };
      state.assets.push(derivative);
      await event(state, { type: 'DERIVATIVE', assetId: derivative.id, parentAssetId: asset.id, parentAsset: asset.id, transformation: input.transformation, description: input.description, demo: derivative.demo });
      return derivative;
    }),
    annotate: (asset, input) => update(async state => {
      if (!validateManualAnnotation(input)) throw new Error('Invalid annotation schema.');
      if (asset.mode === 'preview') throw new Error('Render this derivative before annotating it; its preview shows the parent image.');
      const saved = await ensure(state, asset);
      const annotation = { ...input, id: `annotation_${crypto.randomUUID()}`, source: 'MANUAL', revision: 1, createdAt: new Date().toISOString() };
      saved.manualAnnotations = [...(saved.manualAnnotations || []), annotation];
      await event(state, { type: 'MANUAL_ANNOTATION', assetId: asset.id, annotation, demo: Boolean(asset.demo) });
      return { asset: saved, annotation };
    }),
    changeAnnotation: (input, action) => update(async state => {
      const asset = state.assets.find(item => item.id === input.assetId);
      const change = changeManualAnnotation(asset, input, action);
      asset.manualAnnotations = change.manualAnnotations;
      for (const value of change.events) await event(state, value);
      return { asset, annotation: change.annotation, annotationId: input.annotationId };
    }),
    saveClaim: (input, assets) => update(async state => {
      if (!validateClaim(input, assets)) throw new Error('Claim must link to existing evidence.');
      if (input.id && !state.claims.some(claim => claim.id === input.id)) throw new Error('Claim not found.');
      for (const id of input.assetIds) await ensure(state, assets.find(asset => asset.id === id));
      const claim = { statement: input.statement.trim(), assetIds: [...new Set(input.assetIds)], status: input.status, id: input.id || `claim_${crypto.randomUUID()}`, localOnly: true, updatedAt: new Date().toISOString() };
      state.claims = [...state.claims.filter(item => item.id !== claim.id), claim];
      await event(state, { type: input.id ? 'CLAIM_REVIEW' : 'CLAIM_ADDED', assetId: claim.assetIds[0], claimId: claim.id, claim });
      return { claim };
    }),
    async export(input, assets) {
      await pending;
      const manifest = await buildManifest({ ...db, mode: 'sandbox', assets: [...new Map([...demoAssets, ...assets, ...db.assets].map(asset => [asset.id, asset])).values()] }, input);
      return { filename: 'impactlens-sandbox-manifest.json', manifest };
    },
    upload: input => update(async state => {
      if (typeof input.image !== 'string' || !/^(https?:\/\/|data:image\/(png|jpe?g|webp|gif);base64,)/i.test(input.image)) throw new Error('Choose an image file or an HTTP(S) image URL.');
      if (input.storage === 'cloudinary') throw new Error('Cloudinary uploads require the server workspace.');
      const asset = {
        id: `sandbox_asset_${crypto.randomUUID()}`, name: input.name || 'evidence-image',
        location: input.location || 'Local sandbox', secureUrl: input.image,
        status: 'ORIGINAL', storage: 'sandbox', localOnly: true, demo: Boolean(input.demo),
        tag: input.demo ? 'ILLUSTRATIVE DEMO' : 'ORIGINAL', createdAt: new Date().toISOString(),
        sourceReferenceSha256: await sha256(input.image)
      };
      state.assets.push(asset);
      await event(state, { type: 'ORIGINAL', assetId: asset.id, sourceReferenceSha256: asset.sourceReferenceSha256, demo: asset.demo });
      return { asset, analysis: null, mode: 'sandbox' };
    }),
    async request(path, { method = 'GET', body = {}, signal } = {}) {
      signal?.throwIfAborted();
      await pending;
      const assets = [...new Map([...demoAssets, ...db.assets].map(asset => [asset.id, asset])).values()];
      const asset = assets.find(item => item.id === (body.assetId || body.parentAssetId));
      if (method === 'GET') {
        if (path === '/status') return { mode: 'sandbox', cloudinary: false, ai: false, mockVision: true, persistent: Boolean(storage) };
        if (path === '/assets') return { assets: structuredClone(db.assets) };
        if (path === '/claims') return { claims: structuredClone(db.claims) };
        if (path === '/provenance') return sandbox.provenance();
      }
      if (method === 'POST') {
        if (path === '/upload') return sandbox.upload(body);
        if (path === '/claims') return sandbox.saveClaim(body, assets);
        if (path === '/reports/export') return sandbox.export(body, assets);
        if (!asset) throw new Error('Asset not found in the local sandbox.');
        if (path === '/analysis') return sandbox.analyze(asset);
        if (path === '/annotations') return sandbox.annotate(asset, body.annotation);
        if (path === '/derivatives') return sandbox.derivative(asset, body);
      }
      if (path === '/annotations' && ['PATCH', 'DELETE'].includes(method)) {
        return sandbox.changeAnnotation(body, method === 'PATCH' ? 'update' : 'delete');
      }
      throw new Error('This operation requires the server workspace.');
    }
  };
  return sandbox;
}
