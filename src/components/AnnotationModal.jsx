import { useRef, useState } from 'react';
import { normalizedRegion, validateManualAnnotation } from '../lib/evidence.js';
import Modal from './Modal.jsx';

export default function AnnotationModal({ asset, annotation, initialRegion, onSave, onClose, busy }) {
  const [label, setLabel] = useState(annotation?.label || '');
  const [category, setCategory] = useState(annotation?.category || 'Visual evidence');
  const [confidence, setConfidence] = useState(annotation ? annotation.confidence * 100 : 80);
  const [observation, setObservation] = useState(annotation?.observation || '');
  const [interpretation, setInterpretation] = useState(annotation?.interpretation || '');
  const [region, setRegion] = useState(initialRegion || annotation?.region || { left: 0.1, top: 0.1, width: 0.3, height: 0.3 });
  const [error, setError] = useState('');
  const start = useRef(null);
  const point = event => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height };
  };
  const move = event => { if (start.current) setRegion(normalizedRegion(start.current, point(event))); };
  const submit = async event => {
    event.preventDefault();
    const annotation = { label: label.trim(), category: category.trim(), confidence: Number(confidence) / 100, region, observation: observation.trim(), interpretation: interpretation.trim() };
    if (!validateManualAnnotation(annotation)) return setError('Complete all fields and choose a non-empty region entirely inside the image (coordinates 0–1).');
    setError('');
    try { await onSave(annotation); } catch (failure) { setError(failure.message); }
  };
  return <Modal title={annotation ? 'Edit manual annotation' : 'Add manual annotation'} titleId="annotation-heading" onClose={onClose} busy={busy} wide>
    <form onSubmit={submit}><div className="modal-body annotation-layout">
      <div><p className="control-help">{annotation ? `Editing revision ${annotation.revision || 1}. The previous revision is retained in the ledger.` : 'This is recorded as a MANUAL analyst annotation.'} Drag a rectangle over the image, or edit its exact normalized coordinates below.</p>
        <div className="annotation-stage" onPointerDown={event => { if (busy || event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); start.current = point(event); move(event); }} onPointerMove={move} onPointerUp={event => { move(event); start.current = null; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={() => { start.current = null; }}>
          <img src={asset.secureUrl || asset.image} alt={`Annotate ${asset.name}`} draggable={false} /><div className="annotation-region" style={{ left: `${region.left * 100}%`, top: `${region.top * 100}%`, width: `${region.width * 100}%`, height: `${region.height * 100}%` }} />
        </div>
        {asset.demo && <p className="image-label">ILLUSTRATIVE DEMO ASSET</p>}
        <fieldset className="region-fields" disabled={busy}><legend>Normalized region (0–1)</legend>{['left', 'top', 'width', 'height'].map(key => <label className="control-field" key={key}>{key}<input type="number" min="0" max="1" step="any" required value={Number.isFinite(region[key]) ? region[key] : ''} onChange={event => setRegion(current => ({ ...current, [key]: event.target.value === '' ? NaN : Number(event.target.value) }))} /></label>)}</fieldset>
      </div>
      <div>{error && <div className="upload-error" role="alert">{error}</div>}<label className="control-field">Element label<input required value={label} onChange={event => setLabel(event.target.value)} disabled={busy} /></label><label className="control-field">Category<input required value={category} onChange={event => setCategory(event.target.value)} disabled={busy} /></label><label className="control-field">Analyst confidence: {confidence}%<input type="range" min="0" max="100" value={confidence} onChange={event => setConfidence(event.target.value)} disabled={busy} /></label><label className="control-field">OBSERVATION · visible facts<textarea required rows={3} value={observation} onChange={event => setObservation(event.target.value)} disabled={busy} placeholder="What is directly visible in this region?" /></label><label className="control-field">INTERPRETATION · inference<textarea required rows={3} value={interpretation} onChange={event => setInterpretation(event.target.value)} disabled={busy} placeholder="What might it mean? Include uncertainty." /></label></div>
    </div><div className="modal-footer"><button type="button" className="secondary-btn" onClick={onClose} disabled={busy}>Cancel</button><button className="upload-btn" disabled={busy}>{busy ? 'Saving annotation…' : annotation ? 'Save annotation changes' : 'Save annotation & ledger event'}</button></div></form>
  </Modal>;
}
