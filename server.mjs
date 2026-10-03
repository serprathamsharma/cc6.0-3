import http from 'node:http';
import os from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import { v2 as cloudinary } from 'cloudinary';
import { demoAssets } from './src/data/demo.js';
import { createIntegrations } from './server/integrations.mjs';
import { buildManifest, verifyEvidence } from './server/reports.mjs';
import { validateClaim, validateManualAnnotation } from './src/lib/evidence.js';
import { changeManualAnnotation } from './src/lib/annotations.js';
import { createStore } from './server/store.mjs';

if (existsSync(new URL('./.env', import.meta.url))) {
  loadEnvFile(fileURLToPath(new URL('./.env', import.meta.url)));
}

const PORT = Number(process.env.PORT || 8787);
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DB_DIR = process.env.IMPACTLENS_DATA_DIR || (isServerless ? os.tmpdir() : fileURLToPath(new URL('./.data/', import.meta.url)));
const store = createStore(DB_DIR);
const integrations = createIntegrations(process.env);
const { configured, aiConfigured } = integrations;

function json(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'access-control-allow-headers': 'Content-Type,Authorization'
  });
  res.end(JSON.stringify(payload));
}

async function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  let raw = '';
  for await (const chunk of req) raw += chunk;
  try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function append(db, event) {
  const previousHash = db.ledger.at(-1)?.hash || 'GENESIS';
  const entry = { timestamp: new Date().toISOString(), ...structuredClone(event), previousHash };
  entry.hash = hash(JSON.stringify(entry));
  db.ledger.push(entry);
  return entry;
}

async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        'access-control-allow-headers': 'Content-Type,Authorization'
      });
      return res.end();
    }
    const rawUrl = req.headers['x-forwarded-url'] || req.url || '/api';
    const parsedUrl = new URL(rawUrl, `http://${req.headers?.host || 'localhost'}`);
    const routeParam = parsedUrl.searchParams.get('route');

    let pathname;
    if (routeParam) {
      pathname = `/api/${routeParam.replace(/^\/+/, '')}`;
    } else {
      pathname = parsedUrl.pathname;
      if (!pathname.startsWith('/api')) {
        pathname = `/api${pathname.startsWith('/') ? '' : '/'}${pathname}`;
      }
    }

    const db = await store.read();

    if (req.method === 'GET' && (pathname === '/api' || pathname === '/api/')) {
      return json(res, 200, {
        service: 'ImpactLens API',
        mode: configured || aiConfigured ? 'configured' : 'local',
        status: 'online',
        endpoints: [
          '/api/status',
          '/api/integrations/openai/check',
          '/api/integrations/cloudinary/check',
          '/api/cloudinary/signature',
          '/api/assets',
          '/api/upload',
          '/api/cloudinary/search',
          '/api/cloudinary/resource',
          '/api/cloudinary/analyze',
          '/api/analysis',
          '/api/annotations',
          '/api/claims',
          '/api/derivatives',
          '/api/provenance',
          '/api/provenance/verify',
          '/api/reports/export'
        ]
      });
    }

    if (req.method === 'GET' && pathname === '/api/status') {
      return json(res, 200, {
        mode: configured || aiConfigured ? 'configured' : 'local',
        cloudinary: configured,
        ai: aiConfigured,
        mockVision: integrations.mockVision,
        model: integrations.model,
        capabilities: {
          upload: true,
          cloudinaryUpload: configured,
          deliveryTransformations: configured,
          assetAnalysis: aiConfigured || integrations.mockVision,
          visualSearch: false,
          generativeRemove: false,
          videoTranscription: false
        }
      });
    }

    if (req.method === 'POST' && /^\/api\/integrations\/(openai|cloudinary)\/check$/.test(pathname)) {
      return json(res, 200, await integrations.check(pathname.split('/')[3]));
    }

    if (req.method === 'GET' && pathname === '/api/cloudinary/signature') {
      if (!configured) return json(res, 503, { error: 'Cloudinary credentials unavailable', mode: 'demo' });
      const timestamp = Math.round(Date.now() / 1000);
      return json(res, 200, {
        timestamp,
        signature: cloudinary.utils.api_sign_request({ timestamp, folder: 'impactlens/originals' }, process.env.CLOUDINARY_API_SECRET),
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        folder: 'impactlens/originals'
      });
    }

    if (req.method === 'POST' && pathname === '/api/upload') {
      const input = await body(req);
      if (typeof input.image !== 'string' || !/^(https?:\/\/|data:image\/(png|jpe?g|webp|gif);base64,)/i.test(input.image)) return json(res, 400, { error: 'An HTTP(S) image URL or a PNG, JPEG, WebP or GIF file is required.' });
      const storage = input.storage || (configured ? 'cloudinary' : 'local');
      if (!['cloudinary', 'local'].includes(storage)) return json(res, 400, { error: 'storage must be cloudinary or local' });

      let publicId = `upload_${randomUUID().slice(0, 8)}`;
      let secureUrl = input.image;
      let resourceType = 'image';

      if (storage === 'cloudinary') {
        const uploadRes = await integrations.upload(input.image);
        publicId = uploadRes.public_id;
        secureUrl = uploadRes.secure_url;
        resourceType = uploadRes.resource_type || 'image';
      }

      const assetId = `asset_${randomUUID().slice(0, 8)}`;
      const asset = {
        id: assetId,
        publicId,
        secureUrl,
        name: input.name || `evidence-${Date.now().toString().slice(-4)}.jpg`,
        location: input.location || 'Field Site · Sector 01',
        date: input.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        resourceType,
        storage,
        originalSha256: input.image.startsWith('data:') ? hash(Buffer.from(input.image.split(',')[1], 'base64')) : null,
        sourceReferenceSha256: hash(secureUrl),
        createdAt: new Date().toISOString(),
        status: 'ORIGINAL',
        tag: input.demo ? 'ILLUSTRATIVE DEMO' : 'ORIGINAL',
        demo: Boolean(input.demo)
      };

      await store.update(current => {
        current.assets.push(asset);
        append(current, { type: 'ORIGINAL', assetId: asset.id, publicId: asset.publicId, originalSha256: asset.originalSha256, sourceReferenceSha256: asset.sourceReferenceSha256, demo: asset.demo, actor: input.actor || 'field-analyst' });
      });

      return json(res, 201, { asset, analysis: null, mode: storage });
    }

    if (req.method === 'POST' && pathname === '/api/assets') {
      const input = await body(req);
      if (!input.publicId || !input.secureUrl) return json(res, 400, { error: 'publicId and secureUrl are required' });
      const asset = {
        id: input.assetId || `asset_${randomUUID().slice(0, 8)}`,
        cloudinaryAssetId: input.cloudinaryAssetId || input.assetId || null,
        publicId: input.publicId,
        secureUrl: input.secureUrl,
        name: input.name || input.publicId.split('/').pop() || 'evidence-asset.jpg',
        location: input.location || 'Field Survey Site',
        date: input.date || new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        resourceType: input.resourceType || 'image',
        storage: 'cloudinary',
        originalSha256: input.originalSha256 || null,
        createdAt: new Date().toISOString(),
        status: 'ORIGINAL',
        tag: 'ORIGINAL'
      };
      await store.update(current => {
        if (current.assets.some(item => item.id === asset.id) || demoAssets.some(item => item.id === asset.id)) {
          throw Object.assign(new Error('This asset ID is already registered.'), { status: 409 });
        }
        current.assets.push(asset);
        append(current, { type: 'ORIGINAL', assetId: asset.id, publicId: asset.publicId, actor: input.actor || 'user' });
      });
      return json(res, 201, { asset, analysis: null, mode: configured ? 'configured' : 'local' });
    }

    if (req.method === 'GET' && pathname === '/api/assets') {
      return json(res, 200, { assets: db.assets });
    }

    if (req.method === 'GET' && pathname === '/api/cloudinary/search') {
      if (!configured) return json(res, 503, { error: 'Cloudinary credentials unavailable', mode: 'demo' });
      const expression = parsedUrl.searchParams.get('expression') || 'resource_type:image';
      const maxResults = Math.min(Number(parsedUrl.searchParams.get('max_results') || 30), 100);
      const request = cloudinary.search.expression(expression).sort_by('created_at', 'desc').max_results(maxResults);
      const cursor = parsedUrl.searchParams.get('next_cursor');
      if (cursor) request.next_cursor(cursor);
      const result = await request.execute();
      return json(res, 200, { resources: result.resources || [], next_cursor: result.next_cursor || null, expression });
    }

    if (req.method === 'GET' && pathname === '/api/cloudinary/resource') {
      if (!configured) return json(res, 503, { error: 'Cloudinary credentials unavailable', mode: 'demo' });
      const assetId = parsedUrl.searchParams.get('asset_id');
      const publicId = parsedUrl.searchParams.get('public_id');
      if (!assetId && !publicId) return json(res, 400, { error: 'asset_id or public_id is required' });
      const resource = assetId ? await cloudinary.api.resource_by_asset_id(assetId) : await cloudinary.api.resource(publicId);
      return json(res, 200, resource);
    }

    if (req.method === 'POST' && pathname === '/api/cloudinary/analyze') {
      if (!configured) return json(res, 503, { error: 'Cloudinary credentials unavailable', mode: 'demo' });
      const input = await body(req);
      if (!input.uri) return json(res, 400, { error: 'uri is required' });
      try {
        const result = await cloudinary.analysis.analyze_uri(input.uri, input.analysis || 'captioning');
        return json(res, 200, { provider: 'cloudinary', result });
      } catch (error) {
        return json(res, 502, { error: error.error?.message || error.message, capability: 'Cloudinary Analysis API may require an enabled subscription' });
      }
    }

    if (req.method === 'POST' && pathname === '/api/analysis') {
      const input = await body(req);
      const fixture = demoAssets.find(a => a.id === input.assetId || a.name === input.assetId);
      const asset = db.assets.find(a => a.id === input.assetId) || (fixture ? { ...fixture, secureUrl: fixture.image } : null);
      if (!asset) return json(res, 404, { error: 'asset not found' });
      if (asset.mode === 'preview') return json(res, 422, { error: 'Render this derivative before analysis; its preview still shows the parent image.' });
      const analysis = await integrations.analyze(asset);
      await store.update(current => {
        let savedAsset = current.assets.find(item => item.id === asset.id);
        if (!savedAsset) {
          savedAsset = { ...asset };
          current.assets.push(savedAsset);
          append(current, { type: 'ORIGINAL', assetId: asset.id, demo: Boolean(asset.demo), actor: 'demo-fixture' });
        }
        savedAsset.analysis = analysis;
        append(current, { type: 'ANALYSIS', assetId: asset.id, model: analysis.model, provider: analysis.provider, analysisSha256: hash(JSON.stringify(analysis)), elementCount: analysis.observations.length });
      });
      return json(res, 200, analysis);
    }

    if (req.method === 'POST' && pathname === '/api/derivatives') {
      const input = await body(req);
      const parent = db.assets.find(a => a.id === input.parentAssetId) || demoAssets.find(a => a.id === input.parentAssetId);
      if (!parent) return json(res, 404, { error: 'parent asset not found' });
      const transformation = input.transformation ?? 'c_fill,w_1200,h_800';
      if ((typeof transformation !== 'string' || !transformation.trim()) && (!transformation || typeof transformation !== 'object' || Array.isArray(transformation) || !Object.keys(transformation).length)) {
        return json(res, 400, { error: 'A non-empty transformation string or object is required.' });
      }
      const label = input.label || 'TRANSFORMED DERIVATIVE';
      const transformationText = typeof transformation === 'string' ? transformation : JSON.stringify(transformation);
      if (/\b(?:e_)?gen_[a-z_]+/.test(transformationText)) {
        return json(res, 422, { error: 'Generative transformations are not enabled. Use a supported non-generative transformation.' });
      }
      const type = input.type || 'focus';
      const publicId = `${parent.publicId || parent.id}-derivative-${Date.now()}`;
      let secureUrl;
      let source = parent;
      const steps = [transformationText];
      const visited = new Set();
      while (source.parentAssetId || source.parentAsset) {
        if (visited.has(source.id)) return json(res, 422, { error: 'Cyclic parent lineage.' });
        visited.add(source.id);
        steps.unshift(source.transformation);
        source = db.assets.find(asset => asset.id === (source.parentAssetId || source.parentAsset));
        if (!source) return json(res, 422, { error: 'Missing source in parent lineage.' });
      }
      const deliverable = Boolean(configured && source.publicId && source.storage === 'cloudinary');
      if (deliverable) {
        secureUrl = cloudinary.url(source.publicId, {
          secure: true,
          transformation: steps.map(step => {
            try { const parsed = JSON.parse(step); if (parsed && typeof parsed === 'object') return parsed; } catch { /* Raw Cloudinary transformation. */ }
            return { raw_transformation: step };
          })
        });
      } else {
        secureUrl = parent.secureUrl || parent.image;
      }
      const derivative = {
        id: `derivative_${randomUUID().slice(0, 8)}`,
        parentAssetId: parent.id,
        parentAsset: parent.id,
        publicId,
        secureUrl,
        status: 'DERIVATIVE',
        tag: 'DERIVATIVE',
        name: label,
        label,
        type,
        location: parent.location,
        mode: deliverable ? 'cloudinary' : 'preview',
        demo: Boolean(parent.demo),
        description: input.description || transformationText,
        transformation: transformationText,
        createdAt: new Date().toISOString()
      };
      await store.update(current => {
        if (!current.assets.some(asset => asset.id === parent.id)) {
          current.assets.push({ ...parent, secureUrl: parent.secureUrl || parent.image });
          append(current, { type: 'ORIGINAL', assetId: parent.id, demo: Boolean(parent.demo), actor: 'demo-fixture' });
        }
        current.assets.push(derivative);
        append(current, {
          type: 'DERIVATIVE',
          assetId: derivative.id,
          parentAssetId: parent.id,
          parentAsset: parent.id,
          transformation: derivative.transformation,
          description: derivative.description,
          mode: derivative.mode,
          demo: derivative.demo,
          actor: input.actor || 'user'
        });
      });
      return json(res, 201, derivative);
    }

    if (req.method === 'GET' && pathname === '/api/provenance/verify') {
      return json(res, 200, await verifyEvidence(db));
    }

    if (req.method === 'GET' && pathname === '/api/provenance') {
      return json(res, 200, { ledger: db.ledger, verification: await verifyEvidence(db), mode: 'server' });
    }

    if (req.method === 'POST' && pathname === '/api/annotations') {
      const input = await body(req);
      if (!validateManualAnnotation(input.annotation)) return json(res, 400, { error: 'Annotation requires separate observation and interpretation, a label, category, confidence and valid normalized region.' });
      const annotation = { ...input.annotation, id: `annotation_${randomUUID()}`, source: 'MANUAL', revision: 1, createdAt: new Date().toISOString() };
      const asset = await store.update(current => {
        let target = current.assets.find(item => item.id === input.assetId);
        if (!target) {
          const fixture = demoAssets.find(item => item.id === input.assetId);
          if (!fixture) throw Object.assign(new Error('Asset not found.'), { status: 404 });
          target = { ...fixture, secureUrl: fixture.image };
          current.assets.push(target);
          append(current, { type: 'ORIGINAL', assetId: target.id, demo: true, actor: 'demo-fixture' });
        }
        if (target.mode === 'preview') throw Object.assign(new Error('Render this derivative before annotating it; the preview shows its parent image.'), { status: 422 });
        target.manualAnnotations = [...(target.manualAnnotations || []), annotation];
        append(current, { type: 'MANUAL_ANNOTATION', assetId: target.id, annotation, demo: Boolean(target.demo), actor: 'field-analyst' });
        return target;
      });
      return json(res, 201, { asset, annotation });
    }

    if (['PATCH', 'DELETE'].includes(req.method) && pathname === '/api/annotations') {
      const input = await body(req);
      const result = await store.update(current => {
        const asset = current.assets.find(item => item.id === input.assetId);
        const change = changeManualAnnotation(asset, input, req.method === 'PATCH' ? 'update' : 'delete');
        asset.manualAnnotations = change.manualAnnotations;
        for (const event of change.events) append(current, { ...event, actor: 'field-analyst' });
        return { asset, annotation: change.annotation, annotationId: input.annotationId };
      });
      return json(res, 200, result);
    }

    if (req.method === 'GET' && pathname === '/api/claims') return json(res, 200, { claims: db.claims || [] });

    if (req.method === 'POST' && pathname === '/api/claims') {
      const input = await body(req);
      const claim = await store.update(current => {
        if (!validateClaim(input, [...current.assets, ...demoAssets])) throw Object.assign(new Error('A claim needs a statement, valid status, and existing evidence asset IDs.'), { status: 400 });
        current.claims ||= [];
        const index = current.claims.findIndex(item => item.id === input.id);
        if (input.id && index < 0) throw Object.assign(new Error('Claim not found.'), { status: 404 });
        for (const id of input.assetIds) {
          if (!current.assets.some(asset => asset.id === id)) {
            const fixture = demoAssets.find(asset => asset.id === id);
            current.assets.push({ ...fixture, secureUrl: fixture.image });
            append(current, { type: 'ORIGINAL', assetId: id, demo: true, actor: 'demo-fixture' });
          }
        }
        const result = { id: input.id || `claim_${randomUUID()}`, statement: input.statement.trim(), assetIds: [...new Set(input.assetIds)], status: input.status, updatedAt: new Date().toISOString() };
        if (index < 0) current.claims.push(result); else current.claims[index] = result;
        append(current, { type: index < 0 ? 'CLAIM_ADDED' : 'CLAIM_REVIEW', claimId: result.id, assetId: result.assetIds[0], claim: result, actor: 'field-analyst' });
        return result;
      });
      return json(res, 201, { claim });
    }

    if (req.method === 'POST' && pathname === '/api/reports/export') {
      const input = await body(req);
      if (input.assetIds !== undefined && (!Array.isArray(input.assetIds) || !input.assetIds.every(id => typeof id === 'string'))) {
        return json(res, 400, { error: 'assetIds must be an array of asset IDs.' });
      }
      if (input.claims !== undefined && !Array.isArray(input.claims)) return json(res, 400, { error: 'claims must be an array.' });
      return json(res, 200, {
        filename: 'impactlens-evidence-manifest.json',
        manifest: await buildManifest(db, input)
      });
    }

    return json(res, 404, { error: 'not found' });
  } catch (error) {
    return json(res, error.status || 500, { error: error.message || error.error?.message || 'Request failed', provider: error.provider, code: error.code });
  }
}

export default handler;
export { handler };

const isMain = process.argv[1] && (
  process.argv[1].endsWith('server.mjs') ||
  process.argv[1].endsWith('server.js')
);

if (isMain && !process.env.VERCEL) {
  http.createServer(handler).on('error', error => {
    console.error(error.code === 'EADDRINUSE' ? `API port ${PORT} is already in use. Stop the other process or set PORT in .env.` : error.message);
    process.exit(1);
  }).listen(PORT, '127.0.0.1', () =>
    console.log(`ImpactLens API listening on http://127.0.0.1:${PORT} (Cloudinary ${configured ? 'configured' : 'not configured'}; OpenAI ${aiConfigured ? 'configured' : 'not configured'})`)
  );
}
