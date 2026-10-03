import { Activity } from 'lucide-react';

export default function Header({ tab, setTab, status, connections, onCheck, onProvenance, sandbox, onToggleSandbox, busy }) {
  return <><header><div className="crumb">EVIDENCE INTELLIGENCE <span>/</span> {tab.toUpperCase()}</div><div className="header-actions">
    {!sandbox && ['openai', 'cloudinary'].map(provider => <button key={provider} className="cloud-state integration-button" disabled={busy} onClick={() => onCheck(provider)}><span className={`dot ${connections[provider] === 'connected' ? 'green' : 'amber'}`} />{provider === 'openai' ? 'OpenAI' : 'Cloudinary'} · {connections[provider] === 'checking' ? 'Checking…' : connections[provider] === 'connected' ? 'Connected' : status.mode === 'offline' ? 'API offline' : status.mode === 'loading' ? 'Loading…' : (provider === 'openai' ? status.ai : status.cloudinary) ? 'Check connection' : 'Setup needed'}</button>)}
    <button className="secondary-btn" disabled={busy} onClick={onToggleSandbox}>{sandbox ? 'Return to server' : 'Offline sandbox'}</button><button className="icon-btn" aria-label="Inspect provenance ledger" onClick={onProvenance} disabled={busy}><Activity size={17} /></button>
  </div></header><nav className="mobile-nav" aria-label="Mobile navigation">{[['workspace', 'Workspace'], ['library', 'Library'], ['compare', 'Compare'], ['reports', 'Reports']].map(([key, label]) => <button key={key} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}>{label}</button>)}</nav></>;
}
