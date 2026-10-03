import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, Focus, ImagePlus, Split, FileText } from 'lucide-react';
import { demoWorkspaces } from '../data/demo.js';

export default function Sidebar({ tab, setTab, assets, onSelectAsset, sandbox }) {
  const [workspace, setWorkspace] = useState(demoWorkspaces[0]);
  const [open, setOpen] = useState(false);
  const dropdown = useRef(null);
  const trigger = useRef(null);
  useEffect(() => {
    if (!open) return;
    const dismissOutside = event => { if (!dropdown.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', dismissOutside, true);
    document.addEventListener('focusin', dismissOutside);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside, true);
      document.removeEventListener('focusin', dismissOutside);
    };
  }, [open]);
  const select = item => {
    setWorkspace(item); setOpen(false);
    const asset = assets.find(asset => asset.id === item.assetId);
    if (asset) onSelectAsset(asset.id);
    setTab('workspace');
  };
  return <aside className="sidebar">
    <div className="brand"><div className="brandmark">✦</div><div><b>impact<span>lens</span></b><small>VISUAL EVIDENCE</small></div></div>
    <div ref={dropdown} className="workspace-switch-wrap" onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); } }}>
      <button ref={trigger} className="workspace-switch" aria-expanded={open} aria-controls="workspace-options" onClick={() => setOpen(!open)}><span className="dot" style={{ background: workspace.dotColor }} />{workspace.name}<ChevronDown size={14} /></button>
      {open && <div id="workspace-options" className="workspace-dropdown-menu">
        <div className="workspace-dropdown-header">ILLUSTRATIVE PROJECTS</div>
        {demoWorkspaces.map(item => <button key={item.id} className={`workspace-item ${workspace.id === item.id ? 'active' : ''}`} onClick={() => select(item)}>
          <span className="dot" style={{ background: item.dotColor }} /><span className="workspace-item-content"><b>{item.name}</b><small>{item.category}</small></span>{workspace.id === item.id && <Check size={14} />}
        </button>)}
      </div>}
    </div>
    <nav aria-label="Main navigation">{[['workspace', Focus, 'Element workspace'], ['library', ImagePlus, 'Evidence library'], ['compare', Split, 'Comparisons'], ['reports', FileText, 'Audit & reports']].map(([key, Icon, label]) =>
      <button key={key} className={`nav-item ${tab === key ? 'active' : ''}`} aria-current={tab === key ? 'page' : undefined} onClick={() => setTab(key)}><Icon size={18} /><span>{label}</span>{tab === key && <span className="nav-line" />}</button>)}</nav>
    <div className="nav-label">ILLUSTRATIVE PROJECT SIGNALS</div>
    {demoWorkspaces.slice(0, 2).map(item => <button className="signal" key={item.id} onClick={() => select(item)}><span className="signal-dot" style={{ background: item.dotColor }} /><span><b>{item.name}</b><small>{item.signalsCount} sample features</small></span></button>)}
    <div className="sidebar-bottom"><div className="mode"><span className={`dot ${sandbox ? 'amber' : 'green'}`} /><div><b>{sandbox ? 'Local offline sandbox' : 'Evidence workspace'}</b><small>Originals retain their provenance</small></div></div><div className="profile"><div className="avatar">AK</div><div><b>Field analyst</b><small>Visual evidence review</small></div></div></div>
  </aside>;
}
