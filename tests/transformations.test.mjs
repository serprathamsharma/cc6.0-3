import test from 'node:test';
import assert from 'node:assert/strict';
import { createTransformation } from '../src/lib/transformations.js';
const asset = { id: 'source', publicId: 'impactlens/originals/source' };
const element = { label: 'Tree', region: { left: 0, top: 80, width: 30, height: 20 } };

test('padded focus crops stay inside image bounds and retain exact parent and description', () => {
  const result = createTransformation(asset, element, 'focus', { padding: 2 });
  assert.equal(result.parentAssetId, asset.id);
  assert.match(result.transformation, /x_0.000000,y_0.600000,w_0.600000,h_0.400000/);
  assert.match(result.description, /2× region padding/);
  assert.equal(asset.transformation, undefined);
});

test('color splash uses a same-source overlay over a grayscale base with retained coordinates', () => {
  const result = createTransformation(asset, element, 'isolate', { colorSplash: true });
  assert.match(result.transformation, /^e_grayscale\/l_impactlens:originals:source\//);
  assert.match(result.transformation, /fl_layer_apply,fl_region_relative,g_north_west/);
  assert.match(result.description, /original-color Tree/);
});

test('contrast intensity changes both delivery parameters and description', () => {
  const result = createTransformation(asset, element, 'compare', { intensity: 65 });
  assert.equal(result.transformation, 'e_contrast:65/e_sharpen:130');
  assert.match(result.description, /contrast 65 and sharpening 130/);
});
