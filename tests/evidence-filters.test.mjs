import test from 'node:test';
import assert from 'node:assert/strict';
import { categoriesForAssets, filterAssets } from '../src/lib/evidence.js';
import { filterClaims } from '../src/lib/reports.js';

const element = category => ({
  label: 'Visible feature', category, confidence: 0.8,
  region: { left: 0, top: 0, width: 0.5, height: 0.5 },
  observation: 'A textured surface is visible.', interpretation: 'May be maintained ground.'
});
const fixtures = () => [
  { id: 'survey', status: 'ORIGINAL', name: 'survey.jpg', category: 'Field survey', categories: ['Vegetation', ' '],
    analysis: { observations: [element('Ground cover'), element('vegetation')] },
    manualAnnotations: [{ ...element(' Ground   cover '), id: 'manual-1', source: 'MANUAL' }] },
  { id: 'building', status: 'ORIGINAL', name: 'building.jpg', analysis: { observations: [element('Built environment'), element('GROUND COVER')] } },
  { id: 'preview', status: 'DERIVATIVE', name: 'solar-water-crop.jpg', category: 'Transportation', mode: 'preview' }
];

test('categories come from asset metadata and active elements with case-normalized counts', () => {
  const assets = fixtures();
  const original = structuredClone(assets);
  const counts = Object.fromEntries(categoriesForAssets(assets).map(category => [category.id, category.elementCount]));
  assert.deepEqual(counts, { 'built environment': 1, 'field survey': 0, 'ground cover': 3, transportation: 0, vegetation: 1 });
  assert.equal(categoriesForAssets(assets).find(category => category.id === 'ground cover').label, 'Ground cover');
  assert.deepEqual(assets, original);
  assets[0].manualAnnotations = [];
  assert.equal(categoriesForAssets(assets).find(category => category.id === 'ground cover').elementCount, 2);
  assets[0].analysis.observations[0].category = 'Habitat condition';
  assert.equal(categoriesForAssets(assets).find(category => category.id === 'habitat condition').elementCount, 1);
});

test('library filters match actual categories rather than filename heuristics and combine with search/status', () => {
  const assets = fixtures();
  assert.deepEqual(filterAssets(assets, { category: 'GROUND COVER' }).map(asset => asset.id), ['survey', 'building']);
  assert.deepEqual(filterAssets(assets, { category: 'Field survey' }).map(asset => asset.id), ['survey']);
  assert.deepEqual(filterAssets(assets, { category: 'Transportation', status: 'derivative' }).map(asset => asset.id), ['preview']);
  assert.deepEqual(filterAssets(assets, { category: 'ground cover', query: 'building', status: 'original' }).map(asset => asset.id), ['building']);
  assert.deepEqual(filterAssets(assets, { category: 'Water' }), []);
  assert.deepEqual(categoriesForAssets([]), []);
  assert.equal(filterAssets(assets, { category: '' }).length, 3);
});

test('claim filters combine review status and case-insensitive statement or linked asset ID search', () => {
  const claims = [
    { id: 'one', statement: 'Ground cover is visible.', status: 'VERIFIED', assetIds: ['asset_Forest_01'] },
    { id: 'two', statement: 'Water condition needs review.', status: 'PENDING REVIEW', assetIds: ['asset_lake_02'] },
    { id: 'three', statement: 'Ground cover interpretation disputed.', status: 'CONFLICTED', assetIds: ['asset_Forest_01', 'crop_03'] }
  ];
  assert.deepEqual(filterClaims(claims, { query: '  GROUND COVER  ' }).map(claim => claim.id), ['one', 'three']);
  assert.deepEqual(filterClaims(claims, { query: 'FOREST_01', status: 'VERIFIED' }).map(claim => claim.id), ['one']);
  assert.deepEqual(filterClaims(claims, { query: 'CROP_03', status: 'CONFLICTED' }).map(claim => claim.id), ['three']);
  assert.deepEqual(filterClaims(claims, { query: 'forest_01', status: 'PENDING REVIEW' }), []);
  assert.deepEqual(filterClaims(claims), claims);
  assert.deepEqual(filterClaims([], { query: 'anything' }), []);
});
