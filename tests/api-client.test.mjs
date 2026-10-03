import test from 'node:test';
import assert from 'node:assert/strict';
import { apiRequest } from '../src/lib/api.js';

test('centralized requests preserve headers, body, cancellation and timeout together', async t => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, '/api/assets');
    assert.equal(options.headers['x-request'], 'test');
    assert.equal(options.body, '{"name":"test"}');
    controller.abort();
    assert.equal(options.signal.aborted, true);
    throw options.signal.reason;
  });
  await assert.rejects(apiRequest('/assets', { method: 'POST', body: { name: 'test' }, headers: { 'x-request': 'test' }, signal: controller.signal, timeout: 1000 }), { name: 'AbortError' });
});

test('network failures use an explicit supplied demo fallback; provider failures never do', async t => {
  const mock = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('offline'); });
  assert.deepEqual(await apiRequest('/analysis', { demoFallback: () => ({ demo: true }) }), { demo: true });
  mock.mock.mockImplementation(async () => Response.json({ error: 'Quota exhausted', provider: 'openai' }, { status: 429 }));
  await assert.rejects(apiRequest('/analysis', { demoFallback: () => assert.fail('Must not disguise quota errors') }), { status: 429 });
});

test('external abort and request deadline remain independent', async t => {
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async (url, options) => new Promise((resolve, reject) => {
    const keepAlive = setTimeout(resolve, 1000);
    options.signal.addEventListener('abort', () => { clearTimeout(keepAlive); reject(options.signal.reason); }, { once: true });
  }));
  await assert.rejects(apiRequest('/slow', { signal: controller.signal, timeout: 5, demoFallback: () => assert.fail('A timeout must not repeat a possibly saved mutation') }), { timeout: true });
  assert.equal(controller.signal.aborted, false);
});
