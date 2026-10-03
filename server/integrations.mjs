import { v2 as cloudinary } from 'cloudinary';
import { analysisSchema, validateAnalysis } from '../src/lib/analysis.js';
import { simulateAnalysis } from '../src/lib/simulation.js';

export class IntegrationError extends Error {
  constructor(message, provider, status = 502) {
    super(message);
    this.provider = provider;
    this.status = status;
  }
}

export function createIntegrations(env, { fetchImpl = fetch, cloudinaryClient = cloudinary } = {}) {
  const configured = Boolean(env.CLOUDINARY_CLOUD_NAME?.trim() && env.CLOUDINARY_API_KEY?.trim() && env.CLOUDINARY_API_SECRET?.trim());
  const aiConfigured = Boolean(env.OPENAI_API_KEY?.trim());
  const model = env.OPENAI_VISION_MODEL?.trim() || 'gpt-4o-mini';
  const mockVision = env.MOCK_VISION === 'true';
  if (configured) cloudinaryClient.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME.trim(), api_key: env.CLOUDINARY_API_KEY.trim(),
    api_secret: env.CLOUDINARY_API_SECRET.trim(), secure: true, timeout: 60000
  });

  function requireProvider(provider) {
    if (provider === 'openai' && !aiConfigured) {
      throw new IntegrationError('OpenAI is not configured. Set OPENAI_API_KEY in .env and restart npm run dev.', provider, 503);
    }
    if (provider === 'cloudinary' && !configured) {
      throw new IntegrationError('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env and restart npm run dev.', provider, 503);
    }
  }

  function providerError(provider, error, status) {
    const title = provider === 'openai' ? 'OpenAI' : 'Cloudinary';
    if (status === 401 || status === 403) return new IntegrationError(`${title} rejected the credentials. Check the server-side .env settings and restart npm run dev.`, provider);
    if (status === 429) {
      const code = error?.error?.code || error?.code;
      const failure = new IntegrationError(['insufficient_quota', 'credit_balance_exhausted'].includes(code)
        ? `${title} API quota is exhausted. Add API credits or use a key from a funded project, then retry.`
        : `${title} quota or rate limit reached. Check billing/credits and retry.`, provider, 429);
      failure.code = code;
      return failure;
    }
    let detail = String(error?.error?.message || error?.message || 'The provider could not be reached.');
    const secrets = [env.OPENAI_API_KEY, env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET]
      .map(secret => secret?.trim()).filter(Boolean).sort((a, b) => b.length - a.length);
    for (const secret of secrets) {
      detail = detail.replaceAll(secret, '[redacted]');
    }
    return new IntegrationError(`${title}: ${detail}`, provider);
  }

  async function openAIRequest(endpoint, options = {}) {
    requireProvider('openai');
    let response;
    try {
      response = await fetchImpl(`https://api.openai.com/v1/${endpoint}`, {
        ...options,
        headers: { authorization: `Bearer ${env.OPENAI_API_KEY.trim()}`, 'content-type': 'application/json' },
        signal: AbortSignal.timeout(options.method === 'POST' ? 60000 : 15000)
      });
    } catch (error) {
      throw providerError('openai', error);
    }
    const payload = await response.json().catch(() => null);
    if (!response.ok) throw providerError('openai', payload, response.status);
    if (!payload) throw new IntegrationError('OpenAI returned an invalid JSON response.', 'openai');
    return payload;
  }

  return {
    configured, aiConfigured, model, mockVision,
    async check(provider) {
      requireProvider(provider);
      if (provider === 'openai') {
        await openAIRequest(`models/${encodeURIComponent(model)}`);
        return { provider, connected: true, model, message: `OpenAI credentials accepted; ${model} is available. Run an analysis to check inference quota.` };
      }
      if (provider !== 'cloudinary') throw new IntegrationError('Unknown provider.', provider, 400);
      try {
        await cloudinaryClient.api.ping({ timeout: 15000 });
        return { provider, connected: true, message: 'Cloudinary connection verified. Uploads are ready.' };
      } catch (error) {
        throw providerError(provider, error, error.http_code || error.error?.http_code);
      }
    },
    async upload(image) {
      requireProvider('cloudinary');
      try {
        return await cloudinaryClient.uploader.upload(image, { folder: 'impactlens/originals', overwrite: false, resource_type: 'image', timeout: 60000 });
      } catch (error) {
        throw providerError('cloudinary', error, error.http_code || error.error?.http_code);
      }
    },
    async analyze(asset) {
      if (!aiConfigured && mockVision) return simulateAnalysis(asset);
      let payload;
      try { payload = await openAIRequest('chat/completions', {
        method: 'POST',
        body: JSON.stringify({
          model, temperature: 0,
          messages: [{ role: 'user', content: [
            { type: 'text', text: 'Analyze this evidence image. Return only meaningful visible elements. Do not infer identities or claim uncertain facts. Keep observation strictly separate from interpretation. Bounding regions use normalized 0..1 coordinates and must fit inside the image. Return an empty observations array if no elements can be identified.' },
            { type: 'image_url', image_url: { url: asset.secureUrl || asset.image, detail: 'high' } }
          ] }],
          response_format: { type: 'json_schema', json_schema: { name: 'impactlens_analysis', strict: true, schema: analysisSchema } }
        })
      }); } catch (error) {
        if (mockVision && error.status === 429) return simulateAnalysis(asset);
        throw error;
      }
      const message = payload.choices?.[0]?.message;
      if (message?.refusal) throw new IntegrationError('OpenAI declined to analyze this image. Try another evidence image.', 'openai', 422);
      let parsed;
      try { parsed = JSON.parse(message?.content); } catch { /* Validated below. */ }
      if (!validateAnalysis(parsed)) throw new IntegrationError('OpenAI returned an invalid analysis schema or bounding region. Please retry.', 'openai');
      return { ...parsed, model, provider: 'openai', status: 'AI_ANALYSIS', assetId: asset.id, createdAt: new Date().toISOString() };
    }
  };
}
