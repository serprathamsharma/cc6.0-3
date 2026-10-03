import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntegrations, IntegrationError } from '../server/integrations.mjs';
import { validateAnalysis } from '../src/lib/analysis.js';

const asset = { id: 'uploaded-image', secureUrl: 'https://example.test/evidence.png' };
const observation = {
  label: 'Tree', confidence: 0, category: 'Vegetation',
  region: { left: 0.1, top: 0.2, width: 0.3, height: 0.4 },
  observation: 'Green foliage and a trunk are visible.',
  interpretation: 'May provide shade near the path.'
};
const reply = content => Response.json({ choices: [{ message: { content: JSON.stringify(content) }, finish_reason: 'stop' }] });

test('unconfigured integrations reject operations without invoking providers', async () => {
  const integrations = createIntegrations({}, { fetchImpl: () => assert.fail('Unexpected external request') });
  await assert.rejects(integrations.analyze(asset), { provider: 'openai', status: 503 });
  await assert.rejects(integrations.upload(asset.secureUrl), { provider: 'cloudinary', status: 503 });
  assert.equal(integrations.aiConfigured, false);
  assert.equal(integrations.configured, false);
});

test('analysis requests strict schema and preserves zero confidence and separated observations', async () => {
  const integrations = createIntegrations({ OPENAI_API_KEY: 'test-key' }, {
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.openai.com/v1/chat/completions');
      const request = JSON.parse(options.body);
      assert.equal(request.response_format.json_schema.strict, true);
      assert.equal(request.messages[0].content[1].image_url.url, asset.secureUrl);
      return reply({ observations: [observation] });
    }
  });
  const result = await integrations.analyze(asset);
  assert.equal(result.assetId, asset.id);
  assert.equal(result.provider, 'openai');
  assert.deepEqual(result.observations, [observation]);
});

test('empty analysis is a valid result rather than a trigger for demo detections', async () => {
  const integrations = createIntegrations({ OPENAI_API_KEY: 'test-key' }, {
    fetchImpl: async () => reply({ observations: [] })
  });
  assert.deepEqual((await integrations.analyze(asset)).observations, []);
});

test('quota exhaustion and invalid credentials surface provider failures', async () => {
  for (const status of [429, 401, 403]) {
    const integrations = createIntegrations({ OPENAI_API_KEY: 'test-key' }, {
      fetchImpl: async () => Response.json({ error: { message: 'Provider failure' } }, { status })
    });
    await assert.rejects(integrations.analyze(asset), error => {
      assert.ok(error instanceof IntegrationError);
      assert.equal(error.provider, 'openai');
      assert.equal(error.status, status === 429 ? 429 : 502);
      return true;
    });
  }
});

test('malformed, refused and out-of-bounds model responses are rejected', async () => {
  const messages = [
    { content: 'not json' },
    { refusal: 'Cannot analyze this image' },
    { content: JSON.stringify({ observations: [{ ...observation, region: { left: 0.8, top: 0, width: 0.5, height: 1 } }] }) },
    { content: JSON.stringify({ observations: [{ ...observation, confidence: 99 }] }) }
  ];
  for (const message of messages) {
    const integrations = createIntegrations({ OPENAI_API_KEY: 'test-key' }, {
      fetchImpl: async () => Response.json({ choices: [{ message }] })
    });
    await assert.rejects(integrations.analyze(asset), IntegrationError);
  }
});

test('exhausted billing quota gives a specific actionable error', async () => {
  for (const code of ['insufficient_quota', 'credit_balance_exhausted']) {
    const integrations = createIntegrations({ OPENAI_API_KEY: 'test-key' }, {
      fetchImpl: async () => Response.json({ error: { code, message: 'Quota exhausted' } }, { status: 429 })
    });
    await assert.rejects(integrations.analyze(asset), error => {
      assert.equal(error.code, code);
      assert.match(error.message, /Add API credits/);
      return true;
    });
  }
});

test('runtime validation rejects schema drift and invalid regions', () => {
  const invalid = [
    { observations: [], extra: true },
    { observations: [{ ...observation, observation: '' }] },
    { observations: [{ ...observation, confidence: NaN }] },
    { observations: [{ ...observation, region: { ...observation.region, width: 0 } }] },
    { observations: [{ ...observation, region: { ...observation.region, left: -0.1 } }] },
    { observations: [{ ...observation, interpretation: null }] },
    { observations: [{ ...observation, extra: true }] }
  ];
  for (const value of invalid) assert.equal(validateAnalysis(value), false);
});

test('connection check verifies model access without claiming inference quota', async () => {
  const integrations = createIntegrations({ OPENAI_API_KEY: 'test-key', OPENAI_VISION_MODEL: 'custom-model' }, {
    fetchImpl: async url => {
      assert.ok(url.endsWith('/models/custom-model'));
      return Response.json({ id: 'custom-model' });
    }
  });
  const result = await integrations.check('openai');
  assert.equal(result.connected, true);
  assert.match(result.message, /inference quota/);
});

test('Cloudinary uploads cannot overwrite source assets', async () => {
  const env = { CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: 'test-secret' };
  const integrations = createIntegrations(env, {
    cloudinaryClient: {
      config() {},
      uploader: { async upload(image, options) {
        assert.equal(image, asset.secureUrl);
        assert.equal(options.overwrite, false);
        assert.equal(options.resource_type, 'image');
        return { public_id: 'original', secure_url: asset.secureUrl };
      } }
    }
  });
  assert.equal((await integrations.upload(asset.secureUrl)).public_id, 'original');
});

test('Cloudinary failures do not silently return a local upload', async () => {
  const integrations = createIntegrations({ CLOUDINARY_CLOUD_NAME: 'cloud', CLOUDINARY_API_KEY: 'key', CLOUDINARY_API_SECRET: 'secret' }, {
    cloudinaryClient: {
      config() {},
      uploader: { async upload() { throw { error: { http_code: 429, message: 'No credits' } }; } }
    }
  });
  await assert.rejects(integrations.upload(asset.secureUrl), { provider: 'cloudinary', status: 429 });
});

test('provider failure details redact configured secrets, including trimmed credentials', async () => {
  const integrations = createIntegrations({ OPENAI_API_KEY: ' test-secret ' }, {
    fetchImpl: async () => { throw new Error('Could not send test-secret'); }
  });
  await assert.rejects(integrations.analyze(asset), error => {
    assert.ok(!error.message.includes('test-secret'));
    assert.match(error.message, /\[redacted\]/);
    return true;
  });
});
