export const demoImage = 'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?auto=format&fit=crop&w=1600&q=85';

export const solarElements = [
  {
    id: 'solar-array',
    label: 'Solar Photovoltaic Array',
    color: '#38bdf8',
    confidence: 99,
    category: 'Renewable energy',
    region: { left: 4, top: 20, width: 92, height: 76 },
    observation: 'Multiple continuous rows of angled dark blue photovoltaic solar panel arrays mounted on ground racks across the terrain.',
    interpretation: 'Utility-scale ground-mounted solar energy generation facility supplying clean renewable electricity.',
    count: '14 panel rows'
  },
  {
    id: 'railway',
    label: 'Railway Track & Ballast',
    color: '#e9a85c',
    confidence: 97,
    category: 'Transportation infrastructure',
    region: { left: 16, top: 17, width: 64, height: 17 },
    observation: 'Dual steel rail tracks embedded in a graded crushed stone ballast bed curving across the upper field perimeter.',
    interpretation: 'Active railway transport corridor bordering the north edge of the energy installation.',
    count: '1 rail line'
  },
  {
    id: 'trees',
    label: 'Buffer Trees & Foliage',
    color: '#4caf50',
    confidence: 94,
    category: 'Vegetation',
    region: { left: 28, top: 17, width: 16, height: 19 },
    observation: 'A dense cluster of mature green deciduous trees and shrubs located along the railway embankment buffer.',
    interpretation: 'Natural boundary buffer zone and windbreak vegetation protecting the facility edge.',
    count: '5 mature trees'
  },
  {
    id: 'terrain',
    label: 'Vegetated Terrain Corridor',
    color: '#91b86c',
    confidence: 93,
    category: 'Ground cover',
    region: { left: 20, top: 32, width: 17, height: 50 },
    observation: 'Continuous open green grassland and permeable vegetated corridors running between and around panel blocks.',
    interpretation: 'Maintained vegetative ground cover mitigating soil erosion and aiding stormwater absorption.',
    count: '3 open corridors'
  },
  {
    id: 'service-path',
    label: 'Service Access Route',
    color: '#c084fc',
    confidence: 89,
    category: 'Site infrastructure',
    region: { left: 24, top: 19, width: 14, height: 28 },
    observation: 'Curved unpaved light-toned service access path weaving through the field from the tree line.',
    interpretation: 'Maintenance and vehicle inspection route for routine array servicing and monitoring.',
    count: '1 access route'
  }
];

export const buildingElements = [
  {
    id: 'building-facade',
    label: 'Building Facade',
    color: '#b4a1de',
    confidence: 98,
    category: 'Built environment',
    region: { left: 2, top: 16, width: 94, height: 82 },
    observation: 'Multi-story contemporary residential building with dark vertical paneling and light brick masonry exterior.',
    interpretation: 'Modern urban residential infrastructure in active occupancy.',
    count: '1 structure'
  },
  {
    id: 'balconies',
    label: 'Balconies & Railings',
    color: '#e9a85c',
    confidence: 94,
    category: 'Architectural feature',
    region: { left: 42, top: 38, width: 54, height: 54 },
    observation: 'Multiple cantilevered metal and glass balcony modules stacked vertically along the exterior facade.',
    interpretation: 'Private outdoor living spaces and facade ventilation articulation.',
    count: '8 balconies'
  },
  {
    id: 'windows',
    label: 'Windows & Glazing',
    color: '#67c3c8',
    confidence: 93,
    category: 'Architectural feature',
    region: { left: 14, top: 24, width: 34, height: 68 },
    observation: 'Regular grid of framed rectangular glass window panes reflecting interior and exterior light.',
    interpretation: 'Daylight harvesting apertures for interior residential compartments.',
    count: '12 windows'
  },
  {
    id: 'clear-sky',
    label: 'Clear Sky Horizon',
    color: '#38bdf8',
    confidence: 97,
    category: 'Atmospheric environment',
    region: { left: 28, top: 2, width: 70, height: 38 },
    observation: 'Unobstructed clear blue atmospheric sky above the building roofline without cloud obscuration.',
    interpretation: 'Optimal daylight conditions and minimal haze at time of photographic capture.',
    count: '1 sky field'
  }
];

export const plantationElements = [
  {
    id: 'fern-fronds',
    label: 'Fern Fronds & Foliage',
    color: '#91b86c',
    confidence: 99,
    category: 'Vegetation',
    region: { left: 6, top: 8, width: 88, height: 86 },
    observation: 'Dense overlapping clusters of vibrant green compound fern fronds with delicate pinnate leaflets.',
    interpretation: 'Thriving native understory fern colony indicating high moisture retention and healthy soil biology.',
    count: 'Numerous fronds'
  },
  {
    id: 'canopy-layer',
    label: 'Leaf Canopy Pattern',
    color: '#4caf50',
    confidence: 95,
    category: 'Vegetation canopy',
    region: { left: 14, top: 20, width: 72, height: 50 },
    observation: 'Continuous multi-tiered layer of interlocking green foliage blocking direct ground view.',
    interpretation: 'Established ground-cover canopy moderating microclimate and preventing soil erosion.',
    count: '1 canopy layer'
  },
  {
    id: 'understory-shadow',
    label: 'Understory Recesses',
    color: '#38bdf8',
    confidence: 91,
    category: 'Forest ecology',
    region: { left: 40, top: 48, width: 30, height: 32 },
    observation: 'Deep shaded pockets and sheltered shadow recesses visible beneath upper frond layers.',
    interpretation: 'Cool, humid microhabitat supporting beneficial decomposition and soil microbiota.',
    count: 'Multiple pockets'
  }
];

export const shorelineElements = [
  {
    id: 'water-surface',
    label: 'Water Surface',
    color: '#38bdf8',
    confidence: 99,
    category: 'Natural feature',
    region: { left: 4, top: 38, width: 92, height: 58 },
    observation: 'Wide expanse of open reflective lake water with subtle surface wind ripples.',
    interpretation: 'Primary freshwater reservoir basin exhibiting clear optical characteristics.',
    count: '1 water body'
  },
  {
    id: 'shoreline-bank',
    label: 'Shoreline Bank',
    color: '#e9a85c',
    confidence: 95,
    category: 'Riparian zone',
    region: { left: 8, top: 34, width: 84, height: 16 },
    observation: 'Natural earthen, gravel, and stone shoreline perimeter along the water interface.',
    interpretation: 'Stable littoral boundary zone showing absence of severe scouring or erosion.',
    count: '1 shoreline'
  },
  {
    id: 'riparian-forest',
    label: 'Riparian Forest Belt',
    color: '#4caf50',
    confidence: 94,
    category: 'Vegetation',
    region: { left: 4, top: 12, width: 92, height: 26 },
    observation: 'Dense mature woodland buffer trees lining the perimeter background above the bank.',
    interpretation: 'Protective riparian vegetation corridor preventing runoff siltation.',
    count: 'Forest buffer'
  }
];

export const demoAssets = [
  {
    id: 'asset_00123',
    name: 'solar-array-survey-014.jpg',
    alternateName: 'shoreline-survey-014.jpg',
    location: 'Kaveri Solar Basin · North array',
    date: '14 Jun 2026',
    image: demoImage,
    tag: 'ILLUSTRATIVE DEMO',
    elements: ['Solar Array', 'Railway Track', 'Buffer Trees', 'Green Terrain', 'Service Path'],
    elementsList: solarElements,
    source: 'demo/solar-array-survey-014',
    confidence: 98
  },
  {
    id: 'asset_00124',
    name: 'urban-structure-ward12.jpg',
    alternateName: 'school-tank-before.jpg',
    location: 'Mysuru · Ward 12',
    date: '02 Jun 2026',
    image: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=900&q=80',
    tag: 'ORIGINAL',
    elements: ['Building Facade', 'Balconies', 'Windows', 'Clear Sky'],
    elementsList: buildingElements,
    source: 'demo/urban-structure-ward12',
    confidence: 95
  },
  {
    id: 'asset_00125',
    name: 'plantation-canopy-08.jpg',
    alternateName: 'plantation-day-08.jpg',
    location: 'Kaveri Basin · East bank',
    date: '18 Jun 2026',
    image: 'https://images.unsplash.com/photo-1497250681960-ef046c08a56e?auto=format&fit=crop&w=900&q=80',
    tag: 'ORIGINAL',
    elements: ['Fern Fronds', 'Leaf Canopy', 'Understory Recesses'],
    elementsList: plantationElements,
    source: 'demo/plantation-canopy-08',
    confidence: 96
  },
  {
    id: 'asset_00126',
    name: 'shoreline-survey-015.jpg',
    location: 'Kaveri Lake · North shore',
    date: '20 Jun 2026',
    image: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?auto=format&fit=crop&w=1600&q=85',
    tag: 'ORIGINAL',
    elements: ['Water Surface', 'Shoreline Bank', 'Riparian Forest'],
    elementsList: shorelineElements,
    source: 'demo/shoreline-survey-015',
    confidence: 97
  }
];

export const demoWorkspaces = [
  {
    id: 'kaveri-energy',
    name: 'Kaveri Energy & Ecology',
    category: 'Renewable Infrastructure',
    assetId: 'asset_00123',
    assetsCount: 4,
    signalsCount: 5,
    dotColor: '#81d9a9',
    description: 'Utility-scale solar array and ecological perimeter monitoring'
  },
  {
    id: 'lake-restoration',
    name: 'Lake Restoration & Shore',
    category: 'Freshwater Ecology',
    assetId: 'asset_00126',
    assetsCount: 3,
    signalsCount: 3,
    dotColor: '#67c3c8',
    description: 'Littoral zone stabilization, water purity, and riparian forest health'
  },
  {
    id: 'mysuru-urban',
    name: 'Mysuru Urban Infrastructure',
    category: 'Community Infrastructure',
    assetId: 'asset_00124',
    assetsCount: 3,
    signalsCount: 4,
    dotColor: '#b4a1de',
    description: 'Ward 12 residential daylight harvesting and structural compliance'
  },
  {
    id: 'eastern-ghats',
    name: 'Eastern Ghats Agroforestry',
    category: 'Forest Conservation',
    assetId: 'asset_00125',
    assetsCount: 2,
    signalsCount: 3,
    dotColor: '#e9a85c',
    description: 'Understory biodiversity tracking and canopy moisture retention'
  }
];

export const elements = solarElements;

export function getElementsForAsset(asset) {
  if (!asset) return solarElements;
  if (asset.elementsList && asset.elementsList.length > 0) return asset.elementsList;
  const match = demoAssets.find(a => a.id === asset.id || a.name === asset.name);
  if (match?.elementsList) return match.elementsList;
  return solarElements;
}
