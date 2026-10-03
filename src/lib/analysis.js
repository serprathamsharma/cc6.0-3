const text = { type: 'string' };
const unit = { type: 'number', minimum: 0, maximum: 1 };
const regionKeys = ['left', 'top', 'width', 'height'];
const observationKeys = ['label', 'confidence', 'category', 'region', 'observation', 'interpretation'];

export const analysisSchema = {
  type: 'object', additionalProperties: false, required: ['observations'],
  properties: {
    observations: {
      type: 'array', items: {
        type: 'object', additionalProperties: false, required: observationKeys,
        properties: {
          label: text, confidence: unit, category: text,
          region: {
            type: 'object', additionalProperties: false, required: regionKeys,
            properties: { left: unit, top: unit, width: unit, height: unit }
          },
          observation: text, interpretation: text
        }
      }
    }
  }
};

// Validate provider output at runtime as well as requesting a strict JSON schema.
export function validateAnalysis(value) {
  const exactKeys = (object, keys) => object && typeof object === 'object' && !Array.isArray(object)
    && Object.keys(object).length === keys.length && keys.every(key => Object.hasOwn(object, key));
  const inUnit = number => typeof number === 'number' && Number.isFinite(number) && number >= 0 && number <= 1;
  if (!exactKeys(value, ['observations']) || !Array.isArray(value.observations)) return false;
  return value.observations.every(item => {
    if (!exactKeys(item, observationKeys) || !exactKeys(item.region, regionKeys)) return false;
    if (!['label', 'category', 'observation', 'interpretation'].every(key => typeof item[key] === 'string' && item[key].trim())) return false;
    const { left, top, width, height } = item.region;
    return inUnit(item.confidence) && regionKeys.every(key => inUnit(item.region[key]))
      && width > 0 && height > 0 && left + width <= 1.000001 && top + height <= 1.000001;
  });
}
