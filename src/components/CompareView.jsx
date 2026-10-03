import { useState } from 'react';
import { ArrowLeftRight, Split } from 'lucide-react';

function AssetDetails({ asset }) {
  return <div className="compare-footer">
    <span className={`pill ${asset.status === 'ORIGINAL' ? 'original' : 'derivative'}`}>{asset.status}</span>
    {asset.demo && <span className="pill">ILLUSTRATIVE DEMO</span>}
    {asset.localOnly && <span className="pill">LOCAL SANDBOX</span>}
    <p>{asset.name}</p>
    {asset.parentAsset && <p>Parent: <code>{asset.parentAsset}</code></p>}
    {asset.transformation && <><p>{asset.description}</p><code className="wrap-code">{asset.transformation}</code></>}
    {asset.mode === 'preview' && <p className="preview-notice">Unrendered derivative preview · showing parent image.</p>}
  </div>;
}

export default function CompareView({ assets, comparison, onChange, onOpenWorkspace }) {
  const [position, setPosition] = useState(50);
  const left = assets.find(asset => asset.id === comparison.leftId) || assets[0];
  const right = assets.find(asset => asset.id === comparison.rightId) || assets.find(asset => asset.id !== left?.id) || left;
  const move = event => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setPosition(Math.min(100, Math.max(0, (event.clientX - bounds.left) / bounds.width * 100)));
  };
  const keyMove = event => {
    const changes = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1, PageDown: -10, PageUp: 10 };
    if (event.key in changes || ['Home', 'End'].includes(event.key)) {
      event.preventDefault();
      setPosition(value => event.key === 'Home' ? 0 : event.key === 'End' ? 100 : Math.max(0, Math.min(100, value + changes[event.key])));
    }
  };
  return <div className="library">
    <div className="library-title"><div><div className="eyebrow">CHANGE INTELLIGENCE</div><h1>Compare the evidence.</h1><p>Select any two assets, including saved derivatives. Images are fitted to the same stage; captures are not automatically aligned.</p></div><button className="secondary-btn" onClick={onOpenWorkspace}>Back to workspace</button></div>
    {!left ? <p className="empty-state">Upload evidence to begin a comparison.</p> : <>
      <div className="comparison-controls">
        {[['leftId', 'Left asset', left], ['rightId', 'Right asset', right]].map(([key, label, asset]) => <label className="control-field" key={key}>{label}<select value={asset.id} onChange={event => onChange({ ...comparison, [key]: event.target.value })}>{assets.map(item => <option key={item.id} value={item.id}>{item.name} · {item.status}{item.demo ? ' · DEMO' : ''}{item.mode === 'preview' ? ' · PREVIEW' : ''}</option>)}</select></label>)}
        <button className="icon-btn" aria-label="Swap comparison assets" onClick={() => onChange({ ...comparison, leftId: right.id, rightId: left.id })}><ArrowLeftRight size={18} /></button>
      </div>
      <div className="segmented" aria-label="Comparison layout">{['curtain', 'side-by-side'].map(view => <button key={view} aria-pressed={comparison.view === view} onClick={() => onChange({ ...comparison, view })}><Split size={15} />{view === 'curtain' ? 'Curtain slider' : 'Side by side'}</button>)}</div>
      {comparison.view === 'curtain' ? <div className="compare-card curtain-card">
        <div className="curtain-stage" onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.setPointerCapture(event.pointerId); move(event); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) move(event); }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}>
          <img src={right.secureUrl || right.image} alt={`Right: ${right.name}`} draggable={false} />
          <img src={left.secureUrl || left.image} alt={`Left: ${left.name}`} draggable={false} style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }} />
          <span className="curtain-caption left">LEFT · {left.name}</span><span className="curtain-caption right">RIGHT · {right.name}</span>
          <div className="curtain-divider" style={{ left: `${position}%` }}>
            <button className="curtain-handle" role="slider" aria-label="Comparison curtain position" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(position)} aria-valuetext={`${Math.round(position)}% left image revealed`} onKeyDown={keyMove}><ArrowLeftRight size={22} /></button>
          </div>
        </div>
        <p className="control-help">Drag the divider or focus it and use arrow keys. Home / End reveal either image completely.</p>
        <div className="comparison-details"><AssetDetails asset={left} /><AssetDetails asset={right} /></div>
      </div> : <div className="compare-container">{[left, right].map((asset, index) => <div className="compare-card" key={`${index}-${asset.id}`}><div className="compare-head">{index === 0 ? 'LEFT' : 'RIGHT'} · {asset.name}</div><div className="compare-img"><img src={asset.secureUrl || asset.image} alt={asset.name} /></div><AssetDetails asset={asset} /></div>)}</div>}
    </>}
  </div>;
}
