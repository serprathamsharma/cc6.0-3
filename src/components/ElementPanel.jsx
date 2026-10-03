import { Focus, Layers3, Pencil, Plus, Sparkles, Split, Trash2 } from 'lucide-react';
import TransformCard from './TransformCard.jsx';

export default function ElementPanel({ asset, elements, active, selected, onSelect, transform, onTransform, onGenerate, busy, onAnnotate, onEditAnnotation, onDeleteAnnotation }) {
  return <aside className="element-panel">
    <div className="panel-heading"><div><div className="eyebrow">IMAGE ELEMENTS <span className="count">{elements.length}</span></div><h2>What’s in this image?</h2></div><button className="analyze-inline-btn" disabled={busy || asset.mode === 'preview'} onClick={() => onAnnotate()}><Plus size={14} />Add annotation</button></div>
    <div className="element-list">{!elements.length && <p className="empty-analysis">Run analysis or add a manual annotation to inspect this image.</p>}{elements.map(element => <button key={element.id} className={`element-row ${selected === element.id ? 'chosen' : ''}`} onClick={() => onSelect(element.id)} aria-pressed={selected === element.id}><span className="element-icon" style={{ color: element.color, background: `${element.color}22` }}>{element.label[0]}</span><span className="element-info"><b>{element.label}</b><small>{element.category} · {element.source === 'MANUAL' ? 'MANUAL' : element.source === 'DEMO' ? 'ILLUSTRATIVE DEMO' : 'AI-GENERATED'}</small></span><span className="confidence">{element.confidence}%</span></button>)}</div>
    {active && <>
      <div className="insight"><div className="insight-head"><span className="spark" style={{ color: active.color }}>✦</span><div><div className="eyebrow">SELECTED SIGNAL · {active.source === 'AI' ? 'AI-GENERATED' : active.source}</div><h3>{active.label}</h3></div><span className="confidence-badge">{active.confidence}%</span></div>
        <div className="facts"><div><small>OBSERVATION (VISIBLE FACTS)</small><p>{active.observation}</p></div><div className="interpret"><small>INTERPRETATION (ANALYST / MODEL INFERENCE)</small><p>{active.interpretation}</p></div></div>
        <div className="location">REGION · {active.region.left.toFixed(1)}%, {active.region.top.toFixed(1)}% · {active.count}</div>
      </div>
      {active.source === 'MANUAL' && <div className="annotation-actions">
        <button className="secondary-btn" disabled={busy || asset.mode === 'preview'} onClick={() => onEditAnnotation(active.id)}><Pencil size={14} />Edit Annotation</button>
        <button className="secondary-btn danger-btn" disabled={busy || asset.mode === 'preview'} onClick={() => onDeleteAnnotation(active.id)}><Trash2 size={14} />Delete Annotation</button>
      </div>}
      <div className="actions">{[['focus', Focus, 'Focus'], ['compare', Split, 'Enhance'], ['isolate', Layers3, 'Isolate'], ['shift', Sparkles, 'Optimize']].map(([type, Icon, label]) => <button key={type} disabled={busy || asset.mode === 'preview'} aria-pressed={transform === type} onClick={() => onTransform(type)}><Icon size={15} />{label}</button>)}</div>
      {transform && <TransformCard key={`${asset.id}-${active.id}-${transform}`} type={transform} asset={asset} active={active} onGenerate={onGenerate} onCancel={() => onTransform(null)} busy={busy} />}
    </>}
  </aside>;
}
