import { useState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { createTransformation } from '../lib/transformations.js';

export default function TransformCard({ type, asset, active, onGenerate, onCancel, busy }) {
  const [padding, setPadding] = useState(1.2);
  const [intensity, setIntensity] = useState(40);
  const [colorSplash, setColorSplash] = useState(false);
  let payload, error;
  try { payload = createTransformation(asset, active, type, { padding, intensity, colorSplash }); } catch (failure) { error = failure.message; }
  return <section className="transform-card">
    <div className="transform-heading"><div className="eyebrow">NON-DESTRUCTIVE TRANSFORMATION</div><button className="icon-btn" aria-label="Close transformation controls" onClick={onCancel} disabled={busy}><X size={14} /></button></div>
    <b>{{ focus: 'Focus / reframe region', compare: 'Contrast & edge enhancement', isolate: 'Rectangular region isolation', shift: 'Delivery optimization' }[type]}</b>
    {type === 'focus' && <label className="control-field">Region padding<select value={padding} onChange={event => setPadding(Number(event.target.value))}>{[1.2, 1.5, 2].map(value => <option key={value} value={value}>{value}× region size</option>)}</select></label>}
    {type === 'compare' && <label className="control-field">Enhancement intensity: {intensity}<input type="range" min="0" max="100" value={intensity} onChange={event => setIntensity(Number(event.target.value))} /></label>}
    {type === 'isolate' && <label className="checkbox-label"><input type="checkbox" checked={colorSplash} onChange={event => setColorSplash(event.target.checked)} />Color splash (keep selected rectangle in color)</label>}
    <p>{payload?.description || error}</p>
    <code className="wrap-code">{payload?.transformation}</code>
    <div className="transform-meta"><span>PARENT: {asset.id}</span></div>
    <p>A delivery URL is generated for Cloudinary originals. Local assets produce a labelled, unrendered preview.</p>
    <button className="generate-btn" disabled={busy || !payload} onClick={() => onGenerate(payload)}>{busy ? 'Recording derivative…' : 'Generate derivative'}<ArrowRight size={14} /></button>
  </section>;
}
