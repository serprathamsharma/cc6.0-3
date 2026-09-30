import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { v2 as cloudinary } from 'cloudinary';
import { demoAssets } from './src/data/demo.js';

if (existsSync(new URL('./.env', import.meta.url))) {
  const env = await readFile(new URL('./.env', import.meta.url), 'utf8');
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*["']?([^"']*)["']?\s*$/i);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
}

try { process.loadEnvFile?.(); } catch {}

const PORT = Number(process.env.PORT || 8787);
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DB_DIR = isServerless ? os.tmpdir() : new URL('./.data/', import.meta.url);
const DB_FILE = isServerless ? path.join(os.tmpdir(), 'impactlens.json') : new URL('./.data/impactlens.json', import.meta.url);

const configured = Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
const aiConfigured = Boolean(process.env.OPENAI_API_KEY);
if (configured) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

let memoryDb = { assets: [], ledger: [] };

async function load() {
  try {
    const fileExists = typeof DB_FILE === 'string' ? existsSync(DB_FILE) : existsSync(DB_FILE);
    if (!fileExists) {
      if (typeof DB_DIR === 'string') {
        await mkdir(DB_DIR, { recursive: true });
        await writeFile(DB_FILE, JSON.stringify({ assets: [], ledger: [] }, null, 2));
      } else {
        await mkdir(DB_DIR, { recursive: true });
        await writeFile(DB_FILE, JSON.stringify({ assets: [], ledger: [] }, null, 2));
      }
    }
    const content = await readFile(DB_FILE, 'utf8');
    memoryDb = JSON.parse(content);
    return memoryDb;
  } catch {
    return memoryDb;
  }
}

async function save(db) {
  memoryDb = db;
  try {
    if (typeof DB_DIR === 'string') {
      await mkdir(DB_DIR, { recursive: true });
      await writeFile(DB_FILE, JSON.stringify(db, null, 2));
    } else {
      await mkdir(DB_DIR, { recursive: true });
      await writeFile(DB_FILE, JSON.stringify(db, null, 2));
    }
  } catch {
    // In-memory fallback
  }
}

function json(res, status, payload) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
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
  const entry = { ...event, previousHash };
  entry.hash = hash(JSON.stringify(entry));
  db.ledger.push(entry);
  return entry;
}

function verify(ledger) {
  let previousHash = 'GENESIS';
  for (let i = 0; i < ledger.length; i++) {
    const { hash: actual, ...event } = ledger[i];
    if (hash(JSON.stringify({ ...event, previousHash })) !== actual) {
      return { valid: false, index: i + 1 };
    }
    previousHash = actual;
  }
  return { valid: true };
}

const demoAnalysis = asset => ({
  model: 'impactlens-demo-v1',
  status: 'DEMO_ANALYSIS',
  observations: [
    {
      label: 'water',
      confidence: 0.99,
      category: 'Natural feature',
      region: { left: 0.03, top: 0.05, width: 0.94, height: 0.57 },
      observation: 'A large continuous reflective water surface is visible.',
      interpretation: 'Likely a lake, reservoir, or river edge.'
    },
    {
      label: 'tree',
      confidence: 0.97,
      category: 'Vegetation',
      region: { left: 0.62, top: 0.17, width: 0.28, height: 0.67 },
      observation: 'Dense green canopy and a visible trunk are present.',
      interpretation: 'Mature tree providing shade near the waterline.'
    },
    {
      label: 'waste',
      confidence: 0.88,
      category: 'Environmental signal',
      region: { left: 0.18, top: 0.62, width: 0.24, height: 0.18 },
      observation: 'Multiple plastic-like objects are visible near the shoreline.',
      interpretation: 'The area may contain accumulated waste.'
    }
  ],
  assetId: asset.id,
  createdAt: new Date().toISOString()
});

async function openAIAnalysis(asset) {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
      temperature: 0,
      messages: [{ role: 'user', content: [
        { type: 'text', text: 'Analyze this evidence image. Return only meaningful visible elements. Do not infer identities or claim uncertain facts. Keep observation separate from interpretation. Bounding regions use normalized 0..1 coordinates.' },
        { type: 'image_url', image_url: { url: asset.secureUrl, detail: 'high' } }
      ] }],
      response_format: { type: 'json_schema', json_schema: { name: 'impactlens_analysis', strict: true, schema: {
        type: 'object', additionalProperties: false, required: ['observations'], properties: { observations: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['label','confidence','category','region','observation','interpretation'], properties: {
          label: { type: 'string' }, confidence: { type: 'number' }, category: { type: 'string' }, region: { type: 'object', additionalProperties: false, required: ['left','top','width','height'], properties: { left:{type:'number'},top:{type:'number'},width:{type:'number'},height:{type:'number'} } }, observation:{type:'string'}, interpretation:{type:'string'}
        } } } }
      } } }
    })
  });
  if (!response.ok) throw new Error(`OpenAI analysis failed (${response.status})`);
  const payload = await response.json();
  const parsed = JSON.parse(payload.choices?.[0]?.message?.content || '{}');
  return { model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini', status: 'AI_ANALYSIS', observations: parsed.observations || [], assetId: asset.id, createdAt: new Date().toISOString() };
}

async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
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

    const db = await load();

    if (req.method === 'GET' && (pathname === '/api' || pathname === '/api/')) {
      return json(res, 200, {
        service: 'ImpactLens API',
        mode: configured ? 'connected' : 'demo',
        status: 'online',
        endpoints: [
          '/api/status',
          '/api/cloudinary/signature',
          '/api/assets',
          '/api/analysis',
          '/api/derivatives',
          '/api/provenance',
          '/api/provenance/verify',
          '/api/reports/export'
        ]
      });
    }

    if (req.method === 'GET' && pathname === '/api/status') {
      return json(res, 200, {
        mode: configured || aiConfigured ? 'connected' : 'demo',
        cloudinary: configured,
        ai: aiConfigured,
        capabilities: {
          upload: configured,
          deliveryTransformations: true,
          assetAnalysis: aiConfigured,
          visualSearch: false,
          generativeRemove: false,
          videoTranscription: false
        }
      });
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

    if (req.method === 'POST' && pathname === '/api/assets') {
      const input = await body(req);
      if (!input.publicId || !input.secureUrl) return json(res, 400, { error: 'publicId and secureUrl are required' });
      const asset = {
        id: input.assetId || `asset_${randomUUID().slice(0, 8)}`,
        publicId: input.publicId,
        secureUrl: input.secureUrl,
        resourceType: input.resourceType || 'image',
        originalSha256: input.originalSha256 || null,
        createdAt: new Date().toISOString(),
        status: 'ORIGINAL'
      };
      db.assets.push(asset);
      append(db, { type: 'ORIGINAL', assetId: asset.id, publicId: asset.publicId, actor: input.actor || 'user' });
      await save(db);
      return json(res, 201, { asset, analysis: demoAnalysis(asset), mode: configured ? 'connected' : 'demo' });
    }

    if (req.method === 'GET' && pathname === '/api/assets') {
      return json(res, 200, { assets: db.assets });
    }

    if (req.method === 'POST' && pathname === '/api/analysis') {
      const input = await body(req);
      const fixture = demoAssets.find(a => a.id === input.assetId);
      const asset = db.assets.find(a => a.id === input.assetId) || (fixture ? { id: fixture.id, secureUrl: fixture.image } : null);
      if (!asset) return json(res, 404, { error: 'asset not found' });
      if (!aiConfigured) return json(res, 503, { error: 'OpenAI key is not configured. No analysis was generated.' });
      let analysis;
      try { analysis = await openAIAnalysis(asset); }
      catch (error) { return json(res, 502, { error: error.message }); }
      append(db, { type: 'ANALYSIS', assetId: asset.id, model: analysis.model, elementCount: analysis.observations.length });
      await save(db);
      return json(res, 200, analysis);
    }

    if (req.method === 'POST' && pathname === '/api/derivatives') {
      const input = await body(req);
      const parent = db.assets.find(a => a.id === input.parentAssetId);
      if (!parent) return json(res, 404, { error: 'parent asset not found' });
      if (!configured) {
        return json(res, 200, {
          mode: 'demo',
          status: 'PREVIEW_ONLY',
          parentAssetId: parent.id,
          transformation: input.transformation || 'c_fill,w_1200,h_800',
          label: 'AI / TRANSFORMED DERIVATIVE'
        });
      }
      const publicId = `${parent.publicId}-derivative-${Date.now()}`;
      const secureUrl = cloudinary.url(parent.publicId, {
        secure: true,
        transformation: [input.transformation || { width: 1200, height: 800, crop: 'fill' }]
      });
      const derivative = {
        id: `derivative_${randomUUID().slice(0, 8)}`,
        parentAssetId: parent.id,
        publicId,
        secureUrl,
        status: 'DERIVATIVE',
        transformation: input.transformation || 'c_fill,w_1200,h_800',
        createdAt: new Date().toISOString()
      };
      db.assets.push(derivative);
      append(db, {
        type: 'DERIVATIVE',
        assetId: derivative.id,
        parentAssetId: parent.id,
        transformation: derivative.transformation,
        actor: input.actor || 'user'
      });
      await save(db);
      return json(res, 201, derivative);
    }

    if (req.method === 'GET' && pathname === '/api/provenance/verify') {
      return json(res, 200, verify(db.ledger));
    }

    if (req.method === 'GET' && pathname === '/api/provenance') {
      return json(res, 200, { ledger: db.ledger, verification: verify(db.ledger) });
    }

    if (req.method === 'POST' && pathname === '/api/reports/export') {
      const input = await body(req);
      const relevant = db.assets.filter(a => !input.assetIds || input.assetIds.includes(a.id));
      return json(res, 200, {
        filename: 'impactlens-evidence-manifest.json',
        manifest: {
          title: input.title || 'ImpactLens Evidence Report',
          generatedAt: new Date().toISOString(),
          mode: configured ? 'connected' : 'demo',
          claims: input.claims || [],
          assets: relevant,
          provenance: verify(db.ledger)
        }
      });
    }

    return json(res, 404, { error: 'not found' });
  } catch (error) {
    return json(res, 500, { error: error.message });
  }
}

export default handler;
export { handler };

const isMain = process.argv[1] && (
  process.argv[1].endsWith('server.mjs') ||
  process.argv[1].endsWith('server.js')
);

if (isMain && !process.env.VERCEL) {
  http.createServer(handler).listen(PORT, () =>
    console.log(`ImpactLens API listening on http://127.0.0.1:${PORT} (${configured ? 'Cloudinary connected' : 'demo mode'})`)
  );
}
