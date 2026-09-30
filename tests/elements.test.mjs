import test from 'node:test';
import assert from 'node:assert/strict';
import { demoAssets, solarElements, getElementsForAsset } from '../src/data/demo.js';

test('solar array asset identifies accurate elements instead of wrong shoreline fixtures', () => {
  const solarAsset = demoAssets.find(a => a.id === 'asset_00123');
  assert.ok(solarAsset, 'Solar asset asset_00123 must exist');

  const elements = getElementsForAsset(solarAsset);
  assert.ok(elements.length >= 4, 'Should identify all key visible features');

  // Verify elements are NOT water, waste, person on the solar farm
  const labels = elements.map(e => e.label);
  assert.ok(labels.some(l => l.includes('Solar') || l.includes('Photovoltaic')), 'Must identify solar panels');
  assert.ok(labels.some(l => l.includes('Railway')), 'Must identify railway tracks');
  assert.ok(labels.some(l => l.includes('Trees') || l.includes('Foliage')), 'Must identify buffer trees');

  // Verify schema validation and observation vs interpretation separation
  for (const element of elements) {
    assert.ok(element.id, 'Element must have an id');
    assert.ok(element.label, 'Element must have a label');
    assert.ok(typeof element.confidence === 'number' && element.confidence > 0 && element.confidence <= 100, 'Confidence must be a valid percentage');
    assert.ok(element.region, 'Element must specify a region');
    assert.ok(typeof element.region.left === 'number', 'Region left must be numeric');
    assert.ok(typeof element.region.top === 'number', 'Region top must be numeric');
    assert.ok(typeof element.region.width === 'number' && element.region.width > 0, 'Region width must be positive');
    assert.ok(typeof element.region.height === 'number' && element.region.height > 0, 'Region height must be positive');

    // Rule: Keep OBSERVATION separate from INTERPRETATION
    assert.ok(element.observation && element.observation.length > 10, 'Must have distinct visible observation');
    assert.ok(element.interpretation && element.interpretation.length > 10, 'Must have distinct deduced interpretation');
    assert.notEqual(element.observation, element.interpretation, 'Observation must be distinct from interpretation');
  }
});

test('distinct demo assets return their own accurate element mappings', () => {
  for (const asset of demoAssets) {
    const elements = getElementsForAsset(asset);
    assert.ok(Array.isArray(elements) && elements.length > 0, `Asset ${asset.id} must have elements`);
    assert.ok(elements.every(e => e.observation && e.interpretation), 'Every element must separate observation from interpretation');
  }
});
