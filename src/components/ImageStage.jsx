import { useEffect, useRef, useState } from 'react';
import { Crosshair, Eye, EyeOff, ZoomIn, ZoomOut } from 'lucide-react';
import { normalizedRegion } from '../lib/evidence.js';

const regionStyle = region => ({ left: `${region.left}%`, top: `${region.top}%`, width: `${region.width}%`, height: `${region.height}%` });

export default function ImageStage({ asset, activeDerivative, elements, selected, onSelect, onShowOriginal, onCompare, onAnnotate, busy }) {
  const [zoom, setZoom] = useState(false);
  const [showRegions, setShowRegions] = useState(true);
  const [drawing, setDrawing] = useState(false);
  const [draft, setDraft] = useState(null);
  const [hint, setHint] = useState('');
  const start = useRef(null);
  const stage = useRef(null);
  const drawButton = useRef(null);
  const shown = activeDerivative || asset;
  const canAnnotate = !busy && !activeDerivative && asset.mode !== 'preview';
  const cancel = () => { start.current = null; setDraft(null); setDrawing(false); setHint(''); };
  useEffect(() => { if (!canAnnotate) cancel(); }, [canAnnotate]);
  const point = event => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - bounds.left) / bounds.width, y: (event.clientY - bounds.top) / bounds.height };
  };
  const begin = event => {
    if (!drawing || !canAnnotate || event.button !== 0 || start.current) return;
    const image = event.currentTarget.querySelector('img');
    if (!image?.naturalWidth) { setHint('Wait for the image to load before drawing.'); return; }
    event.preventDefault();
    event.currentTarget.focus();
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = point(event);
    setDraft(normalizedRegion(start.current, start.current)); setHint('');
  };
  const finish = event => {
    if (!start.current) return;
    const region = normalizedRegion(start.current, point(event));
    const bounds = event.currentTarget.getBoundingClientRect();
    start.current = null; setDraft(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (region.width * bounds.width < 3 || region.height * bounds.height < 3) {
      setHint('Drag a rectangle at least 3 pixels wide and high, or enter coordinates.');
      return;
    }
    setDrawing(false); setHint(''); onAnnotate(region);
  };
  const draftStyle = draft && regionStyle(Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, value * 100])));
  return <div className="image-panel">
    <div className="image-toolbar">
      <div><span className={`pill ${shown.status === 'ORIGINAL' ? 'original' : 'derivative'}`}>{shown.status}{shown.mode === 'preview' ? ' PREVIEW' : ''}</span><span className="asset-name">{shown.name}</span></div>
      <div className="toolbar-right">
        <button ref={drawButton} className={`secondary-btn canvas-annotate ${drawing ? 'active' : ''}`} aria-pressed={drawing} aria-controls="primary-evidence-stage" disabled={!canAnnotate} onClick={() => {
          if (drawing) cancel();
          else { setZoom(false); setDrawing(true); setHint(''); stage.current?.focus(); }
        }}><Crosshair size={16} />Annotate</button>
        <button className={`icon-btn dark ${showRegions ? 'active' : ''}`} aria-label={showRegions ? 'Hide element regions' : 'Show element regions'} aria-pressed={showRegions} onClick={() => setShowRegions(!showRegions)}>{showRegions ? <Eye size={16} /> : <EyeOff size={16} />}</button>
        <button className="icon-btn dark" aria-label={zoom ? 'Reset image zoom' : 'Zoom image'} aria-pressed={zoom} disabled={drawing} onClick={() => setZoom(!zoom)}>{zoom ? <ZoomOut size={16} /> : <ZoomIn size={16} />}</button>
      </div>
    </div>
    {drawing && <div id="canvas-annotation-help" className="annotation-hint" role="status">{hint || 'Drag a rectangle directly on the image. Escape cancels.'} <button className="text-btn" onClick={() => { cancel(); onAnnotate(); }}>Enter coordinates</button></div>}
    {shown.demo && <div className="image-label">ILLUSTRATIVE DEMO · sample evidence</div>}
    {shown.mode === 'preview' && <div className="preview-notice">Unrendered derivative preview · parent image shown. {shown.description}</div>}
    <div className="evidence-viewport">
      <div ref={stage} id="primary-evidence-stage" role="group" aria-label="Primary evidence canvas" aria-describedby={drawing ? 'canvas-annotation-help' : undefined} tabIndex={0}
        className={`evidence-stage ${zoom ? 'zoomed' : ''} ${drawing ? 'drawing' : ''}`}
        onPointerDown={begin} onPointerMove={event => { if (start.current) setDraft(normalizedRegion(start.current, point(event))); }} onPointerUp={finish}
        onPointerCancel={() => { start.current = null; setDraft(null); }} onLostPointerCapture={() => { start.current = null; setDraft(null); }}
        onKeyDown={event => { if (drawing && event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); drawButton.current?.focus(); } }}>
        <img src={shown.secureUrl || shown.image} alt={shown.name} draggable={false} />
        {showRegions && !activeDerivative && elements.map(element => <button key={element.id} aria-label={`Select ${element.label}`} aria-pressed={selected === element.id} tabIndex={drawing ? -1 : 0} className={`region ${selected === element.id ? 'selected' : ''}`} style={{ ...regionStyle(element.region), '--region': element.color }} onClick={() => { if (!drawing) onSelect(element.id); }}><span className="region-tag" style={{ background: element.color }}>{element.label.toUpperCase()} · {element.source === 'MANUAL' ? 'MANUAL' : `${element.confidence}%`}</span></button>)}
        {draft && <div className="annotation-draft" style={draftStyle} />}
      </div>
    </div>
    <div className="image-footer"><span><Eye size={14} />{elements.length} elements · {asset.manualAnnotations?.length || 0} manual</span><span>{asset.analysis?.model || (asset.demo ? 'Demo fixture' : 'Analyst workspace')}</span></div>
    {activeDerivative && <div className="derivative-actions"><button className="text-btn" onClick={onShowOriginal}>Return to parent image</button><button className="text-btn" onClick={() => onCompare(asset.id, activeDerivative.id)}>Compare with parent</button></div>}
  </div>;
}
