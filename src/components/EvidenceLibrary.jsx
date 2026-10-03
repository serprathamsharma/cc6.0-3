import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Download, Search, ShieldCheck, Upload } from 'lucide-react';
import { categoriesForAssets, elementsForAsset, filterAssets, verifiedAssetIds } from '../lib/evidence.js';

export default function EvidenceLibrary({ assets, filters, onFiltersChange, provenance, onSelectAsset, onOpenUpload, onExport, busy }) {
  const [selected, setSelected] = useState([]);
  const categories = useMemo(() => categoriesForAssets(assets), [assets]);
  const categoryOptions = [{ id: '', label: 'All categories', elementCount: categories.reduce((total, category) => total + category.elementCount, 0) }, ...categories];
  useEffect(() => {
    if (filters.category && !categories.some(category => category.id === filters.category)) onFiltersChange({ ...filters, category: '' });
  }, [categories, filters, onFiltersChange]);
  const results = useMemo(() => filterAssets(assets, filters), [assets, filters]);
  const verified = verifiedAssetIds(provenance);
  const selection = selected.filter(id => assets.some(asset => asset.id === id));
  const allSelected = results.length > 0 && results.every(asset => selection.includes(asset.id));
  const toggle = id => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  return <div className="library">
    <div className="library-title"><div><div className="eyebrow">EVIDENCE LIBRARY</div><h1>Find the signal.</h1><p>Search observations, field locations, and the complete original-to-derivative collection.</p></div><button className="upload-btn" onClick={onOpenUpload}><Upload size={16} />Upload evidence</button></div>
    <div className="search-box"><Search size={19} /><input id="library-search" aria-label="Search evidence" value={filters.query} onChange={event => onFiltersChange({ ...filters, query: event.target.value })} placeholder="Search elements, filenames or locations…" /><span>⌘ K</span></div>
    <fieldset className="category-filter"><legend>Categories <span className="control-help">· active element counts</span></legend><div className="category-options">
      {categoryOptions.map(category => <button key={category.id} type="button" aria-pressed={filters.category === category.id} aria-label={`${category.label} (${category.elementCount} elements)`} onClick={() => onFiltersChange({ ...filters, category: category.id })}>
        <span>{category.label}</span><span className="category-count" aria-hidden="true">{category.elementCount}</span>
      </button>)}
    </div></fieldset>
    <div className="library-filters">
      <label className="control-field">Status<select value={filters.status} onChange={event => onFiltersChange({ ...filters, status: event.target.value })}>{[['all', 'All assets'], ['original', 'ORIGINAL'], ['derivative', 'DERIVATIVE'], ['ai-generated', 'AI-GENERATED'], ['demo', 'Illustrative demo']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="control-field">Sort by<select value={filters.sort} onChange={event => onFiltersChange({ ...filters, sort: event.target.value })}>{[['newest', 'Newest first'], ['oldest', 'Oldest first'], ['confidence', 'Detection confidence'], ['elements', 'Element count']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    <div className="results-head"><label className="checkbox-label"><input type="checkbox" checked={allSelected} disabled={!results.length} onChange={() => setSelected(current => allSelected ? current.filter(id => !results.some(asset => asset.id === id)) : [...new Set([...current, ...results.map(asset => asset.id)])])} />Select visible · {results.length} assets</label><div className="inline-actions"><span>{selection.length} selected</span>{selection.length > 0 && <button className="text-btn" onClick={() => setSelected([])}>Clear</button>}<button className="secondary-btn" disabled={busy || !selection.length} onClick={() => onExport({ title: 'ImpactLens Selected Evidence Pack', assetIds: selection })}><Download size={15} />Export selected</button></div></div>
    {!results.length && <p className="empty-state">No assets match these filters. Try another category or search term.</p>}
    <div className="asset-grid">{results.map(asset => {
      const elements = elementsForAsset(asset);
      return <article className={`asset-card ${selection.includes(asset.id) ? 'selected-card' : ''}`} key={asset.id}>
        <div className="asset-thumb"><img src={asset.secureUrl || asset.image} alt={asset.name} loading="lazy" /><span className={`pill ${asset.status === 'ORIGINAL' ? 'original' : 'derivative'}`}>{asset.status}</span><label className="asset-select"><input type="checkbox" aria-label={`Select ${asset.name} for export`} checked={selection.includes(asset.id)} onChange={() => toggle(asset.id)} /></label><span className="match">{elements.length} elements</span></div>
        <div className="asset-card-body"><button className="asset-open" onClick={() => onSelectAsset(asset.id)}><b>{asset.name}</b><ArrowRight size={16} /></button><small>{asset.location || 'Location not supplied'} · {asset.date || asset.createdAt?.slice(0, 10)}</small>
          <div className="asset-tags">{asset.demo && <span>ILLUSTRATIVE DEMO</span>}{asset.mode === 'preview' && <span>UNRENDERED PREVIEW</span>}{asset.analysis?.demo && <span>SIMULATED ANALYSIS</span>}{asset.localOnly && <span>LOCAL SANDBOX</span>}</div>
          <div className={`ledger-badge ${verified.has(asset.id) ? 'verified' : ''}`}><ShieldCheck size={13} />{verified.has(asset.id) ? 'Ledger integrity verified' : provenance.mode === 'sandbox' ? 'Sandbox ledger only' : provenance.verification?.valid === false ? 'Ledger verification failed' : 'Not verified in ledger'}</div>
          <div className="asset-tags">{elements.slice(0, 4).map(element => <span key={element.id}>{element.label}</span>)}</div>
        </div>
      </article>;
    })}</div>
  </div>;
}
