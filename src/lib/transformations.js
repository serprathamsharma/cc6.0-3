export function createTransformation(asset, element, type, options = {}) {
  const region = element?.region;
  if (!region || !['left', 'top', 'width', 'height'].every(key => Number.isFinite(region[key])) || region.left < 0 || region.top < 0 || region.width <= 0 || region.height <= 0 || region.left + region.width > 100.0001 || region.top + region.height > 100.0001) throw new Error('Select a valid element region.');
  const factor = Number(options.padding || 1.2);
  if (![1.2, 1.5, 2].includes(factor)) throw new Error('Unsupported focus padding.');
  const width = Math.min(100, region.width * (type === 'focus' ? factor : 1));
  const height = Math.min(100, region.height * (type === 'focus' ? factor : 1));
  const left = Math.max(0, Math.min(100 - width, region.left + (region.width - width) / 2));
  const top = Math.max(0, Math.min(100 - height, region.top + (region.height - height) / 2));
  const fraction = value => (value / 100).toFixed(6);
  const crop = `c_crop,g_north_west,x_${fraction(left)},y_${fraction(top)},w_${fraction(width)},h_${fraction(height)}`;
  const bounds = `left ${left.toFixed(2)}%, top ${top.toFixed(2)}%, width ${width.toFixed(2)}%, height ${height.toFixed(2)}%`;
  const intensity = Number(options.intensity ?? 40);
  if (!Number.isFinite(intensity) || intensity < 0 || intensity > 100) throw new Error('Intensity must be between 0 and 100.');
  let transformation, description;
  if (type === 'focus') {
    transformation = crop; description = `Focus on ${element.label}, ${factor}× region padding; crop ${bounds}.`;
  } else if (type === 'compare') {
    transformation = `e_contrast:${intensity}/e_sharpen:${intensity * 2}`;
    description = `Full-image contrast ${intensity} and sharpening ${intensity * 2}.`;
  } else if (type === 'isolate' && options.colorSplash) {
    // Crop a same-source color overlay, then position it over the grayscale base.
    const layer = asset.publicId && !asset.parentAsset ? `l_${asset.publicId.replaceAll('/', ':')}`
      : `l_fetch:${btoa(asset.secureUrl || asset.image).replaceAll('+', '-').replaceAll('/', '_')}`;
    transformation = `e_grayscale/${layer}/${crop}/fl_layer_apply,fl_region_relative,g_north_west,x_${fraction(left)},y_${fraction(top)}`;
    description = `Color splash: grayscale background with the original-color ${element.label} rectangle at ${bounds}. Rectangular isolation, not object segmentation.`;
  } else if (type === 'isolate') {
    transformation = `${crop}/e_grayscale`; description = `Crop ${element.label} at ${bounds} and convert to grayscale.`;
  } else if (type === 'shift') {
    transformation = 'e_improve/q_auto/f_auto'; description = 'Automatic image improvement, quality selection and delivery format.';
  } else throw new Error('Unknown transformation.');
  return { parentAssetId: asset.id, type, label: `${element.label} · ${type}`, transformation, description };
}
