import { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertCircle, Check, X } from 'lucide-react';
import { demoAssets } from './data/demo.js';
import { createApiClient, downloadManifest } from './lib/api.js';
import { createSandbox } from './lib/sandbox.js';
import { elementsForAsset } from './lib/evidence.js';
import Sidebar from './components/Sidebar.jsx';
import Header from './components/Header.jsx';
import Workspace from './components/Workspace.jsx';
import CompareView from './components/CompareView.jsx';
import EvidenceLibrary from './components/EvidenceLibrary.jsx';
import ReportsView from './components/ReportsView.jsx';
import UploadModal from './components/UploadModal.jsx';
import AnnotationModal from './components/AnnotationModal.jsx';
import ProvenanceModal from './components/ProvenanceModal.jsx';
import './styles.css';

const mergeAssets = saved => [...new Map([...demoAssets, ...saved].map(asset => [asset.id, asset])).values()];
const emptyProvenance = { ledger: [], verification: null };

function App() {
  const [sandbox] = useState(() => {
    let storage;
    try { storage = window.localStorage; } catch { /* Session-only sandbox. */ }
    return createSandbox(storage);
  });
  const [sandboxMode, setSandboxMode] = useState(false);
  const request = useMemo(() => createApiClient(sandboxMode ? sandbox : null), [sandbox, sandboxMode]);
  const [assets, setAssets] = useState(demoAssets);
  const [assetId, setAssetId] = useState(demoAssets[0].id);
  const [selected, setSelected] = useState('solar-array');
  const [tab, setTab] = useState('workspace');
  const [transform, setTransform] = useState(null);
  const [derivativeId, setDerivativeId] = useState(null);
  const [claims, setClaims] = useState([]);
  const [provenance, setProvenance] = useState(emptyProvenance);
  const [status, setStatus] = useState({ mode: 'loading' });
  const [connections, setConnections] = useState({});
  const [busy, setBusy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [modal, setModal] = useState(null);
  const [annotationDraft, setAnnotationDraft] = useState(null);
  const [filters, setFilters] = useState({ query: '', category: '', status: 'all', sort: 'newest' });
  const [comparison, setComparison] = useState({ leftId: demoAssets[0].id, rightId: demoAssets[1].id, view: 'curtain' });
  const asset = assets.find(item => item.id === assetId) || assets[0];
  const elements = useMemo(() => elementsForAsset(asset), [asset]);
  const active = elements.find(item => item.id === selected) || elements[0];
  const derivative = assets.find(item => item.id === derivativeId && item.parentAsset === asset.id);
  const locked = Boolean(busy || loading);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setStatus({ mode: 'loading' });
    setAssets(demoAssets); setClaims([]); setProvenance(emptyProvenance); setConnections({});
    Promise.all(['/status', '/assets', '/claims', '/provenance'].map(path => request(path, { signal: controller.signal, timeout: 10000 })))
      .then(([nextStatus, data, savedClaims, proofs]) => {
        if (controller.signal.aborted) return;
        setStatus(nextStatus); setAssets(mergeAssets(data.assets)); setClaims(savedClaims.claims); setProvenance(proofs);
      }).catch(failure => {
        if (controller.signal.aborted) return;
        setStatus({ mode: 'offline', cloudinary: false, ai: false }); setError(failure.message);
      }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [request]);

  useEffect(() => { setDerivativeId(null); setTransform(null); }, [assetId, sandboxMode]);
  useEffect(() => {
    if (!elements.some(item => item.id === selected)) setSelected(elements[0]?.id || null);
  }, [elements, selected]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const key = event => {
      if (modal || !(event.metaKey || event.ctrlKey)) return;
      if (event.key.toLowerCase() === 'u') { event.preventDefault(); if (!locked) setModal('upload'); }
      if (event.key.toLowerCase() === 'k') { event.preventDefault(); setTab('library'); requestAnimationFrame(() => document.getElementById('library-search')?.focus()); }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [modal, locked]);

  const upsert = next => setAssets(current => current.some(item => item.id === next.id) ? current.map(item => item.id === next.id ? next : item) : [next, ...current]);
  const run = async (operation, action) => {
    if (locked) throw new Error('Wait for the current operation to finish.');
    setBusy(operation); setError('');
    try { return await action(); } finally { setBusy(null); }
  };
  const refreshProofs = async () => {
    try { setProvenance(await request('/provenance')); }
    catch (failure) { setProvenance(emptyProvenance); setError(`Saved, but ledger refresh failed: ${failure.message}`); }
  };
  const selectAsset = id => { setAssetId(id); setTab('workspace'); };
  const closeModal = useCallback(() => setModal(null), []);
  const openAnnotation = region => {
    setAnnotationDraft({ assetId: asset.id, region: region || (active && Object.fromEntries(Object.entries(active.region).map(([key, value]) => [key, value / 100]))) });
    setModal('annotation');
  };
  const editAnnotation = id => {
    const annotation = asset.manualAnnotations?.find(item => item.id === id && item.source === 'MANUAL');
    if (!annotation) return;
    setAnnotationDraft({ assetId: asset.id, annotation });
    setModal('annotation');
  };
  const analyze = () => run('analysis', async () => {
    const analysis = await request('/analysis', { method: 'POST', body: { assetId: asset.id } });
    setAssets(current => current.map(item => item.id === asset.id ? { ...item, analysis } : item));
    if (analysis.provider === 'openai') setConnections(current => ({ ...current, openai: 'connected' }));
    setNotice(`${analysis.demo ? 'Illustrative simulation' : 'AI analysis'} saved · ${analysis.observations.length} elements.`);
    await refreshProofs();
  }).catch(failure => setError(failure.message));
  const generate = payload => run('derivative', async () => {
    const next = await request('/derivatives', { method: 'POST', body: payload });
    upsert(next); setDerivativeId(next.id); setTransform(null);
    setNotice(next.mode === 'preview' ? 'Unrendered derivative preview recorded with exact transformation and retained parent.' : 'Cloudinary derivative recorded with retained parent.');
    await refreshProofs();
  }).catch(failure => setError(failure.message));
  const upload = (input, shouldAnalyze) => run('Saving evidence…', async () => {
    const { asset: uploaded } = await request('/upload', { method: 'POST', body: input });
    upsert(uploaded); setAssetId(uploaded.id); setTab('workspace');
    if (shouldAnalyze) {
      setBusy('Analyzing saved evidence…');
      try {
        const analysis = await request('/analysis', { method: 'POST', body: { assetId: uploaded.id } });
        upsert({ ...uploaded, analysis });
      } catch (failure) { setError(`Upload saved successfully. Analysis failed: ${failure.message}`); }
    }
    setModal(null); setNotice(`Evidence saved to ${sandboxMode ? 'the browser sandbox' : uploaded.storage}.`);
    await refreshProofs();
  });
  const annotate = annotation => run('annotation', async () => {
    const previous = annotationDraft?.annotation;
    const result = await request('/annotations', {
      method: previous ? 'PATCH' : 'POST',
      body: { assetId: annotationDraft.assetId, annotation, ...(previous ? { annotationId: previous.id, expectedRevision: previous.revision || 1 } : {}) }
    });
    upsert(result.asset); setSelected(result.annotation.id); setDerivativeId(null); setTransform(null); setModal(null);
    setNotice(previous ? 'Annotation updated; its previous revision is retained in the ledger.' : 'Manual annotation saved with a ledger event.');
    await refreshProofs();
  });
  const deleteAnnotation = id => run('annotation', async () => {
    const annotation = asset.manualAnnotations?.find(item => item.id === id && item.source === 'MANUAL');
    if (!annotation) throw new Error('Manual annotation not found.');
    const result = await request('/annotations', { method: 'DELETE', body: { assetId: asset.id, annotationId: id, expectedRevision: annotation.revision || 1 } });
    upsert(result.asset); setTransform(null);
    setNotice('Annotation deleted from the canvas; its retraction is recorded in the ledger.');
    await refreshProofs();
  }).catch(failure => setError(failure.message));
  const saveClaim = input => run('claim', async () => {
    const { claim } = await request('/claims', { method: 'POST', body: input });
    setClaims(current => current.some(item => item.id === claim.id) ? current.map(item => item.id === claim.id ? claim : item) : [...current, claim]);
    setNotice(input.id ? 'Claim review persisted.' : 'Evidence-linked claim persisted.'); await refreshProofs();
    return claim;
  });
  const exportReport = input => run('export', async () => {
    downloadManifest(await request('/reports/export', { method: 'POST', body: input }));
    setNotice('Evidence manifest downloaded with a SHA-256 content digest.');
  }).catch(failure => setError(failure.message));
  const preparePrint = input => run('print', async () => (await request('/reports/export', { method: 'POST', body: input })).manifest);
  const verify = () => run('provenance', async () => {
    setProvenance(await request('/provenance')); setModal('provenance');
  }).catch(failure => setError(failure.message));
  const check = provider => run('connection', async () => {
    setConnections(current => ({ ...current, [provider]: 'checking' }));
    try {
      const result = await request(`/integrations/${provider}/check`, { method: 'POST', timeout: 20000 });
      setConnections(current => ({ ...current, [provider]: 'connected' })); setNotice(result.message);
    } catch (failure) { setConnections(current => ({ ...current, [provider]: 'error' })); throw failure; }
  }).catch(failure => setError(failure.message));

  return <div className="app">
    <Sidebar tab={tab} setTab={setTab} assets={assets} onSelectAsset={selectAsset} sandbox={sandboxMode} />
    <main className="main"><Header tab={tab} setTab={setTab} status={status} connections={connections} onCheck={check} onProvenance={verify} sandbox={sandboxMode} onToggleSandbox={() => { setModal(null); setSandboxMode(value => !value); }} busy={locked} />
      {sandboxMode && <div className="sandbox-banner" role="status"><b>LOCAL OFFLINE SANDBOX</b><span>{status.persistent === false ? 'Session-only data.' : 'Saved in this browser only.'} Analysis is illustrative simulation. Derivative previews display the parent image.</span></div>}
      {!sandboxMode && status.mockVision && <div className="sandbox-banner"><b>MOCK_VISION ENABLED</b><span>Missing OpenAI credentials or quota errors can produce explicitly labelled illustrative simulations.</span></div>}
      {notice && <div className="toast" role="status"><Check size={16} />{notice}</div>}
      {error && <div className="error-banner" role="alert"><AlertCircle size={18} /><span>{error}</span>{status.mode === 'offline' && <button className="secondary-btn" onClick={() => setSandboxMode(true)}>Open offline sandbox</button>}<button aria-label="Dismiss error" onClick={() => setError('')}><X size={16} /></button></div>}
      {tab === 'workspace' && <Workspace key={`${sandboxMode}-${asset.id}`} asset={asset} elements={elements} selected={selected} onSelect={setSelected} transform={transform} onTransform={setTransform} onAnalyze={analyze} busy={busy || (loading ? 'loading' : null)} sandbox={sandboxMode} onUpload={() => setModal('upload')} onGenerate={generate} activeDerivative={derivative} onShowOriginal={() => setDerivativeId(null)} onVerifyProvenance={verify} onAnnotate={openAnnotation} onEditAnnotation={editAnnotation} onDeleteAnnotation={deleteAnnotation} onCompare={(leftId, rightId) => { setComparison({ leftId, rightId, view: 'curtain' }); setTab('compare'); }} />}
      {tab === 'library' && <EvidenceLibrary key={String(sandboxMode)} assets={assets} filters={filters} onFiltersChange={setFilters} provenance={provenance} onSelectAsset={selectAsset} onOpenUpload={() => setModal('upload')} onExport={exportReport} busy={locked} />}
      {tab === 'compare' && <CompareView assets={assets} comparison={comparison} onChange={setComparison} onOpenWorkspace={() => setTab('workspace')} />}
      {tab === 'reports' && <ReportsView key={String(sandboxMode)} assets={assets} claims={claims} provenance={provenance} onSaveClaim={saveClaim} onExport={exportReport} onPreparePrint={preparePrint} onSelectAsset={selectAsset} busy={busy || loading} />}
    </main>
    {modal === 'upload' && <UploadModal status={status} onClose={closeModal} onUpload={upload} busy={busy} />}
    {modal === 'annotation' && <AnnotationModal asset={assets.find(item => item.id === annotationDraft.assetId)} annotation={annotationDraft.annotation} initialRegion={annotationDraft.region} onSave={annotate} onClose={closeModal} busy={Boolean(busy)} />}
    {modal === 'provenance' && <ProvenanceModal data={provenance} onClose={closeModal} />}
  </div>;
}

const root = window.__impactlens_root ||= createRoot(document.getElementById('root'));
root.render(<App />);
