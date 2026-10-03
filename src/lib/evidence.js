import { validateAnalysis } from './analysis.js';
import { getElementsForAsset } from '../data/demo.js';

export const claimStatuses = ['VERIFIED', 'PENDING REVIEW', 'CONFLICTED'];

export function validateClaim(claim, assets) {
  return Boolean(claim && typeof claim.statement === 'string' && claim.statement.trim()
    && claimStatuses.includes(claim.status) && Array.isArray(claim.assetIds) && claim.assetIds.length
    && claim.assetIds.every(id => assets.some(asset => asset.id === id)));
}

export function validateManualAnnotation(annotation) {
  return validateAnalysis({ observations: [annotation] });
}

export function normalizedRegion(start, end) {
  const clamp = value => Math.min(1, Math.max(0, value));
  const left = Math.min(clamp(start.x), clamp(end.x));
  const top = Math.min(clamp(start.y), clamp(end.y));
  return { left, top, width: Math.abs(clamp(end.x) - clamp(start.x)), height: Math.abs(clamp(end.y) - clamp(start.y)) };
}

export function elementsForAsset(asset) {
  if (!asset) return [];
  const palette = ['#38bdf8', '#e9a85c', '#82cc8a', '#b2cd88', '#c084fc'];
  const convert = (item, index, manual = false) => ({
    ...item, id: item.id || `ai-${asset.id}-${index}`, color: palette[index % palette.length],
    confidence: Math.round(item.confidence * 100), source: manual ? 'MANUAL' : asset.analysis?.demo ? 'DEMO' : 'AI',
    region: Object.fromEntries(Object.entries(item.region).map(([key, value]) => [key, value * 100])),
    count: manual ? 'Analyst annotation' : asset.analysis?.demo ? 'Illustrative demo' : 'AI detected'
  });
  const valid = asset.analysis && validateAnalysis({ observations: asset.analysis.observations });
  const detected = valid ? asset.analysis.observations.map((item, index) => convert(item, index))
    : asset.analysis ? [] : getElementsForAsset(asset).map(item => ({ ...item, source: 'DEMO' }));
  const manual = (asset.manualAnnotations || []).filter(item => validateManualAnnotation(Object.fromEntries(
    ['label', 'category', 'confidence', 'region', 'observation', 'interpretation'].map(key => [key, item[key]])
  )));
  return [...detected, ...manual.map((item, index) => convert(item, index, true))];
}

export function verifiedAssetIds(provenance) {
  if (!provenance?.verification?.valid || provenance.mode === 'sandbox') return new Set();
  return new Set((provenance.ledger || []).filter(entry => ['ORIGINAL', 'DERIVATIVE', 'AI-GENERATED'].includes(entry.type)).map(entry => entry.assetId));
}

export function buildLineage(ledger) {
  const latest = new Map();
  const claims = new Map();
  return ledger.map((entry, index) => {
    const id = `block-${index}`;
    const parents = entry.claim ? [...new Set([claims.get(entry.claimId), ...entry.claim.assetIds.map(assetId => latest.get(assetId))].filter(Boolean))]
      : [latest.get(entry.assetId) || latest.get(entry.parentAssetId || entry.parentAsset) || 'genesis'];
    if (!parents.length) parents.push('genesis');
    if (entry.claimId) claims.set(entry.claimId, id);
    else if (entry.assetId) latest.set(entry.assetId, id);
    return { id, parent: parents[0], parents, entry, index };
  });
}

const categoryLabel = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
const categoryKey = value => categoryLabel(value).toLowerCase();
const assetCategories = asset => [asset.category, ...(Array.isArray(asset.categories) ? asset.categories : [])].filter(value => categoryLabel(value));

export function categoriesForAssets(assets) {
  const categories = new Map();
  const include = (value, count = 0) => {
    const label = categoryLabel(value);
    if (!label) return;
    const id = categoryKey(label);
    if (!categories.has(id)) categories.set(id, { id, label, elementCount: 0 });
    categories.get(id).elementCount += count;
  };
  for (const asset of assets) {
    for (const category of assetCategories(asset)) include(category);
    for (const element of elementsForAsset(asset)) include(element.category, 1);
  }
  return [...categories.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function filterAssets(assets, { query = '', category = '', status = 'all', sort = 'newest' } = {}) {
  const details = asset => elementsForAsset(asset);
  const text = asset => `${asset.name} ${asset.location || ''} ${asset.category || ''} ${details(asset).map(item => `${item.label} ${item.category}`).join(' ')}`;
  const confidence = asset => Math.max(0, ...details(asset).filter(item => item.source !== 'MANUAL').map(item => item.confidence));
  const date = asset => Date.parse(asset.createdAt || asset.date) || 0;
  return assets.filter(asset => text(asset).toLowerCase().includes(query.trim().toLowerCase())
    && (!category || [...assetCategories(asset), ...details(asset).map(item => item.category)].some(value => categoryKey(value) === categoryKey(category)))
    && (status === 'all' || (status === 'demo' ? asset.demo : asset.status === status.toUpperCase())))
    .sort((a, b) => sort === 'confidence' ? confidence(b) - confidence(a) : sort === 'elements' ? details(b).length - details(a).length : sort === 'oldest' ? date(a) - date(b) : date(b) - date(a));
}
