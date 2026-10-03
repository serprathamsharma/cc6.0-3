import test from 'node:test';
import assert from 'node:assert/strict';
import { createIntegrations } from '../server/integrations.mjs';
import { validateAnalysis } from '../src/lib/analysis.js';

test('opt-in no-key simulation is category-specific, schema-validated and visibly illustrative', async () => {
  const integrations = createIntegrations({ MOCK_VISION: 'true' }, { fetchImpl: () => assert.fail('Simulation should not call providers') });
  const analysis = await integrations.analyze({ id: 'field', name: 'solar-array.jpg' });
  assert.equal(analysis.demo, true);
  assert.equal(analysis.tag, 'ILLUSTRATIVE DEMO');
  assert.equal(analysis.provider, 'simulation');
  assert.equal(validateAnalysis({ observations: analysis.observations }), true);
  assert.ok(analysis.observations.some(item => item.label.includes('Solar')));
  assert.ok(analysis.observations.every(item => item.observation.startsWith('ILLUSTRATIVE DEMO')));
});

test('quota exhaustion only simulates when MOCK_VISION is explicitly enabled', async () => {
  for (const enabled of [false, true]) {
    const integrations = createIntegrations({ OPENAI_API_KEY: 'test', MOCK_VISION: String(enabled) }, { fetchImpl: async () => Response.json({ error: { code: 'insufficient_quota' } }, { status: 429 }) });
    if (!enabled) await assert.rejects(integrations.analyze({ id: 'lake', name: 'lake.jpg' }), { status: 429 });
    else assert.equal((await integrations.analyze({ id: 'lake', name: 'lake.jpg' })).status, 'SIMULATED_ANALYSIS');
  }
});

test('unknown simulation categories return no invented feature detections', async () => {
  const analysis = await createIntegrations({ MOCK_VISION: 'true' }).analyze({ id: 'unknown', name: 'upload.png' });
  assert.deepEqual(analysis.observations, []);
});
