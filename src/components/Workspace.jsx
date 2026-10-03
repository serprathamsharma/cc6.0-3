import { Sparkles, Upload } from 'lucide-react';
import ElementPanel from './ElementPanel.jsx';
import EvidenceStrip from './EvidenceStrip.jsx';
import ImageStage from './ImageStage.jsx';

export default function Workspace({ asset, elements, selected, onSelect, transform, onTransform, onAnalyze, busy, sandbox, onUpload, onGenerate, activeDerivative, onShowOriginal, onVerifyProvenance, onAnnotate, onEditAnnotation, onDeleteAnnotation, onCompare }) {
  const active = elements.find(element => element.id === selected) || elements[0];
  return <div className="workspace">
    <section className="hero-copy"><div><div className="eyebrow"><span className="live-dot" />{asset.analysis?.demo ? 'ILLUSTRATIVE DEMO · SIMULATED ANALYSIS' : asset.analysis ? 'AI-GENERATED ANALYSIS' : asset.demo ? 'ILLUSTRATIVE DEMO · SAMPLE ANNOTATIONS' : 'EVIDENCE WORKSPACE'}</div><h1>See what’s really<br /><em>in the frame.</em></h1><p>Select an element to inspect observation and interpretation, annotate a region, or create a traceable derivative.</p></div><div className="hero-actions"><button className="secondary-btn" disabled={busy || asset.mode === 'preview'} onClick={onAnalyze}><Sparkles size={15} />{busy === 'analysis' ? 'Analyzing…' : sandbox ? 'Simulate analysis' : 'Analyze image'}</button><button className="upload-btn" onClick={onUpload} disabled={Boolean(busy)}><Upload size={16} />Upload evidence</button></div></section>
    <section className="canvas-grid"><ImageStage asset={asset} activeDerivative={activeDerivative} elements={elements} selected={active?.id} onSelect={onSelect} onShowOriginal={onShowOriginal} onCompare={onCompare} onAnnotate={onAnnotate} busy={Boolean(busy)} /><ElementPanel asset={asset} elements={elements} active={active} selected={active?.id} onSelect={onSelect} transform={transform} onTransform={onTransform} onGenerate={onGenerate} busy={Boolean(busy)} onAnnotate={onAnnotate} onEditAnnotation={onEditAnnotation} onDeleteAnnotation={onDeleteAnnotation} /></section>
    <EvidenceStrip asset={asset} activeDerivative={activeDerivative} onVerifyProvenance={onVerifyProvenance} />
  </div>;
}
