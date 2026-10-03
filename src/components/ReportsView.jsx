import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, Pencil, Printer, Search, ShieldCheck, X } from 'lucide-react';
import { claimStatuses } from '../lib/evidence.js';
import { filterClaims, summarizeReport } from '../lib/reports.js';

const claimFilters = [['all', 'All Claims'], ['VERIFIED', 'Verified Only'], ['PENDING REVIEW', 'Pending Review'], ['CONFLICTED', 'Conflicted']];

function PrintableReport({ manifest }) {
  return <section className="print-report">
    <h1>{manifest.title}</h1><p>Generated {manifest.generatedAt} · {manifest.mode.toUpperCase()}</p>
    {['demo', 'mixed', 'sandbox'].includes(manifest.mode) && <p><strong>{manifest.mode === 'sandbox' ? 'LOCAL SANDBOX · illustrative simulations are labelled below.' : 'ILLUSTRATIVE DEMO evidence is included and labelled below.'}</strong></p>}
    <p>{manifest.summary.assets} assets · {manifest.summary.originals} originals · {manifest.summary.derivatives} derivatives · {manifest.summary.aiGenerated} AI-generated assets · {manifest.summary.claims} claims</p>
    <h2>Evidence-linked claims</h2>
    {!manifest.claims.length && <p>No claims have been recorded.</p>}
    {manifest.claims.map(claim => <article key={claim.id}><h3>{claim.status}</h3><p>{claim.statement}</p><p>Evidence: {claim.assetIds.join(', ')}</p>{claim.missingFromPack.length > 0 && <p>Linked evidence outside this pack: {claim.missingFromPack.join(', ')}</p>}</article>)}
    <h2>Evidence inventory</h2>
    {manifest.assets.map(asset => <article key={asset.id}><h3>{asset.name} · {asset.status}{asset.demo ? ' · ILLUSTRATIVE DEMO' : ''}</h3><p>ID: {asset.id}</p>{asset.parentAsset && <p>Parent: {asset.parentAsset}</p>}{asset.mode === 'preview' && <p>UNRENDERED DERIVATIVE PREVIEW · displayed image is the parent.</p>}{asset.description && <p>{asset.description}</p>}{asset.transformation && <pre>{asset.transformation}</pre>}{asset.analysis?.demo && <p>SIMULATED ANALYSIS · ILLUSTRATIVE DEMO</p>}{[...(asset.analysis?.observations || []), ...(asset.manualAnnotations || [])].map((element, index) => <div key={element.id || index}><p><b>{element.label}</b> · {element.source || (asset.analysis?.demo ? 'SIMULATED' : 'AI-GENERATED')}</p><p>OBSERVATION: {element.observation}</p><p>INTERPRETATION: {element.interpretation}</p></div>)}</article>)}
    <h2>Integrity proof</h2><p>Ledger: {manifest.provenance.valid ? 'valid at export' : 'verification failed'}. {manifest.provenance.scope}</p><p>Unregistered assets: {manifest.provenance.unregisteredAssetIds.join(', ') || 'None'}</p><p>Ledger head: <code>{manifest.provenance.ledger.at(-1)?.hash || 'GENESIS (empty ledger)'}</code></p><p>Manifest SHA-256 content digest:</p><pre>{manifest.signature.digest}</pre><p>{manifest.signature.scope}</p>
    <div className="signature-lines"><div>Prepared by: ________________________<br />Signature: __________________________<br />Date: ______________________________</div><div>Reviewed by: ________________________<br />Signature: __________________________<br />Date: ______________________________</div></div>
  </section>;
}

export default function ReportsView({ assets, claims, provenance, onSaveClaim, onExport, onPreparePrint, onSelectAsset, busy }) {
  const [title, setTitle] = useState('ImpactLens Evidence Report');
  const [editing, setEditing] = useState(null);
  const [statement, setStatement] = useState('');
  const [status, setStatus] = useState('PENDING REVIEW');
  const [linked, setLinked] = useState([]);
  const [error, setError] = useState('');
  const [printPack, setPrintPack] = useState(null);
  const [claimStatus, setClaimStatus] = useState('all');
  const [claimQuery, setClaimQuery] = useState('');
  const statementInput = useRef(null);
  const metrics = useMemo(() => summarizeReport(assets, claims), [assets, claims]);
  const visibleClaims = useMemo(() => filterClaims(claims, { status: claimStatus, query: claimQuery }), [claims, claimStatus, claimQuery]);
  const tabKey = (event, index) => {
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? claimFilters.length - 1
      : event.key === 'ArrowRight' ? (index + 1) % claimFilters.length : event.key === 'ArrowLeft' ? (index + claimFilters.length - 1) % claimFilters.length : null;
    if (next === null) return;
    event.preventDefault();
    setClaimStatus(claimFilters[next][0]);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next].focus();
  };
  useEffect(() => {
    if (!printPack) return;
    const frame = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(frame);
  }, [printPack]);
  const reset = () => { setEditing(null); setStatement(''); setStatus('PENDING REVIEW'); setLinked([]); setError(''); };
  const save = async event => {
    event.preventDefault(); setError('');
    if (!linked.length) return setError('Link at least one evidence asset to this claim.');
    try { await onSaveClaim({ ...(editing ? { id: editing } : {}), statement, status, assetIds: linked }); reset(); }
    catch (failure) { setError(failure.message); }
  };
  const print = async () => {
    setError('');
    try { setPrintPack(await onPreparePrint({ title, assetIds: assets.map(asset => asset.id) })); }
    catch (failure) { setError(failure.message); }
  };
  return <div className="library reports-view">
    <div className="report-screen">
      <div className="library-title"><div><div className="eyebrow">AUDIT & REPORTS</div><h1>Evidence-backed claims.</h1><p>Persist linked claims and review decisions. Claim status records analyst judgement; ledger verification checks record integrity.</p></div><FileText size={32} /></div>
      <div className="metrics-grid">{[['Assets', metrics.assets], ['Elements', metrics.elements], ['Derivatives', metrics.derivatives], ['Verified claims', metrics.verifiedClaims], ['Pending review', metrics.pendingClaims], ['Conflicted', metrics.conflictedClaims]].map(([label, value]) => <div className="metric" key={label}><b>{value}</b><span>{label}</span></div>)}</div>
      <div className="report-export"><label className="control-field">Report title<input value={title} onChange={event => setTitle(event.target.value)} /></label><button className="secondary-btn" disabled={busy} onClick={() => onExport({ title, assetIds: assets.map(asset => asset.id) })}><Download size={16} />Export manifest</button><button className="upload-btn" disabled={busy} onClick={print}><Printer size={16} />Print / save PDF</button></div>
      <p className="control-help"><ShieldCheck size={14} />{provenance.mode === 'sandbox' ? 'Local sandbox proofs only.' : provenance.verification?.valid ? 'Workspace ledger integrity verified.' : provenance.verification?.valid === false ? 'Workspace verification failed.' : 'Ledger verification unavailable.'} {metrics.illustrativeAssets} illustrative assets; {assets.filter(asset => asset.analysis?.demo).length} simulated analyses.</p>
      <div className="report-layout"><section className="claims-list">
        <h2>Linked claims <span className="count">{claims.length}</span></h2>
        <div className="claim-filter-tabs" role="tablist" aria-label="Claim status filters">{claimFilters.map(([value, label], index) => <button key={value} id={`claim-filter-${index}`} type="button" role="tab" aria-selected={claimStatus === value} aria-controls="claim-results" tabIndex={claimStatus === value ? 0 : -1} onClick={() => setClaimStatus(value)} onKeyDown={event => tabKey(event, index)}>{label}<span className="category-count">{value === 'all' ? claims.length : claims.filter(claim => claim.status === value).length}</span></button>)}</div>
        <div className="search-box claims-search"><Search size={17} /><input type="search" aria-label="Search claims" value={claimQuery} onChange={event => setClaimQuery(event.target.value)} placeholder="Search statement or linked asset ID…" />{claimQuery && <button className="icon-btn" aria-label="Clear claim search" onClick={() => setClaimQuery('')}><X size={14} /></button>}</div>
        <p className="control-help" role="status">Showing {visibleClaims.length} of {claims.length} claims</p>
        <div id="claim-results" role="tabpanel" aria-labelledby={`claim-filter-${claimFilters.findIndex(([value]) => value === claimStatus)}`}>
          {!claims.length ? <p className="empty-state">No claims yet. Add a statement and link the evidence supporting it.</p> : !visibleClaims.length && <div className="empty-state">No claims match this status and search.<button className="text-btn" onClick={() => { setClaimStatus('all'); setClaimQuery(''); }}>Clear claim filters</button></div>}
          {visibleClaims.map(claim => <article className="claim-card" key={claim.id}>
            <div className="claim-heading"><span className={`claim-status ${claim.status.toLowerCase().replaceAll(' ', '-')}`}>{claim.status}</span><button className="text-btn" disabled={busy} onClick={() => { setEditing(claim.id); setStatement(claim.statement); setStatus(claim.status); setLinked(claim.assetIds); setError(''); statementInput.current?.focus(); }}><Pencil size={13} />Review</button></div>
            <p>{claim.statement}</p><div className="claim-links">{claim.assetIds.map(id => { const asset = assets.find(item => item.id === id); return <button key={id} onClick={() => onSelectAsset(id)} disabled={!asset}>{asset?.name || id}{asset?.demo ? ' · DEMO' : ''}</button>; })}</div>
            <small>Updated {new Date(claim.updatedAt).toLocaleString()}</small>
          </article>)}
        </div>
      </section>
        <form className="claim-form" onSubmit={save}><h2>{editing ? 'Review claim' : 'Add a claim'}</h2>{error && <div className="upload-error" role="alert">{error}</div>}<label className="control-field">Claim statement<textarea ref={statementInput} required rows={4} value={statement} onChange={event => setStatement(event.target.value)} disabled={busy} /></label><label className="control-field">Review status<select value={status} onChange={event => setStatus(event.target.value)} disabled={busy}>{claimStatuses.map(value => <option key={value}>{value}</option>)}</select></label><fieldset className="claim-evidence" disabled={busy}><legend>Linked evidence ({linked.length})</legend>{assets.map(asset => <label className="checkbox-label" key={asset.id}><input type="checkbox" checked={linked.includes(asset.id)} onChange={event => setLinked(current => event.target.checked ? [...current, asset.id] : current.filter(id => id !== asset.id))} /><span>{asset.name}<small>{asset.status}{asset.demo ? ' · ILLUSTRATIVE DEMO' : ''}{asset.mode === 'preview' ? ' · PREVIEW' : ''}</small></span></label>)}</fieldset><div className="inline-actions"><button className="upload-btn" disabled={busy}>{busy === 'claim' ? 'Saving…' : editing ? 'Save review' : 'Save linked claim'}</button>{editing && <button type="button" className="secondary-btn" onClick={reset} disabled={busy}>Cancel review</button>}</div></form>
      </div>
    </div>
    {printPack && <PrintableReport manifest={printPack} />}
  </div>;
}
