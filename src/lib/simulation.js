import { solarElements, buildingElements, plantationElements, shorelineElements, getElementsForAsset } from '../data/demo.js';
import { validateAnalysis } from './analysis.js';

export function simulateAnalysis(asset) {
  const category = `${asset.category || ''} ${asset.name || ''}`;
  const known = getElementsForAsset(asset);
  const elements = known.length ? known : /solar|energy/i.test(category) ? solarElements
    : /water|lake|shore/i.test(category) ? shorelineElements
    : /tree|forest|plant|vegetation/i.test(category) ? plantationElements
    : /building|urban|infrastructure/i.test(category) ? buildingElements : [];
  const observations = elements.map(item => ({
    label: item.label, category: item.category, confidence: item.confidence / 100,
    region: Object.fromEntries(Object.entries(item.region).map(([key, value]) => [key, value / 100])),
    observation: `ILLUSTRATIVE DEMO: ${item.observation}`,
    interpretation: `SIMULATED INTERPRETATION: ${item.interpretation}`
  }));
  if (!validateAnalysis({ observations })) throw new Error('Invalid simulation fixture.');
  return { observations, assetId: asset.id, provider: 'simulation', model: 'Illustrative category fixtures', status: 'SIMULATED_ANALYSIS', demo: true, tag: 'ILLUSTRATIVE DEMO', createdAt: new Date().toISOString() };
}
