import { ImagePlus, Eye, Sparkles, Check, ShieldCheck } from 'lucide-react';
import ChainStep from './ChainStep.jsx';

export default function EvidenceStrip({ asset, activeDerivative, onVerifyProvenance }) {
  return <section className="evidence-strip"><div className="strip-title"><div><div className="eyebrow">EVIDENCE CHAIN & PROVENANCE</div><h2>From capture to defensible claim</h2></div><button className="text-btn" onClick={onVerifyProvenance}><ShieldCheck size={16} />Verify SHA-256 chain</button></div>
    <div className="chain"><ChainStep icon={<ImagePlus />} label={`${asset.status}${asset.demo ? ' · DEMO' : ''}`} detail={asset.id} active /><div className="chain-line" />
      <ChainStep icon={<Eye />} label="OBSERVATIONS" detail={asset.analysis?.demo ? 'Simulated annotations' : asset.analysis ? 'AI-GENERATED · Schema validated' : asset.manualAnnotations?.length ? 'Analyst annotations' : 'Awaiting analysis'} active={Boolean(asset.analysis || asset.manualAnnotations?.length)} /><div className="chain-line" />
      <ChainStep icon={<Sparkles />} label="TRANSFORMATION" detail={activeDerivative?.description || 'Awaiting action'} active={Boolean(activeDerivative)} /><div className="chain-line" />
      <ChainStep icon={<Check />} label={activeDerivative?.mode === 'preview' ? 'DERIVATIVE PREVIEW' : 'DERIVATIVE'} detail={activeDerivative?.id || 'Not generated'} active={Boolean(activeDerivative)} />
    </div></section>;
}
