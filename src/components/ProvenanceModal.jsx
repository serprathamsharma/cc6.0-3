import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, ShieldCheck } from 'lucide-react';
import { buildLineage } from '../lib/evidence.js';
import { buildLedgerCertificate, formatChainDigest, sha256 } from '../lib/provenance.js';
import { downloadJson } from '../lib/api.js';
import Modal from './Modal.jsx';

export default function ProvenanceModal({ data, onClose }) {
  const ledger = data.ledger || [];
  const [selected, setSelected] = useState(Math.max(0, ledger.length - 1));
  const [proof, setProof] = useState(null);
  const [exporting, setExporting] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [copyFallback, setCopyFallback] = useState('');
  const entry = ledger[selected];
  const graph = useMemo(() => {
    const positions = new Map([['genesis', { x: 16, y: 16, depth: 0 }]]);
    const nodes = buildLineage(ledger).map(node => {
      const depth = Math.max(...node.parents.map(parent => positions.get(parent)?.depth || 0)) + 1;
      const position = { x: 16 + depth * 230, y: 16 + (node.index + 1) * 82, depth };
      positions.set(node.id, position);
      return { ...node, ...position };
    });
    return { nodes, positions, width: Math.max(600, ...nodes.map(node => node.x + 224)), height: (nodes.length + 1) * 82 + 20 };
  }, [ledger]);
  useEffect(() => {
    let cancelled = false;
    setProof(null);
    if (entry) {
      const { hash, ...payload } = entry;
      sha256(JSON.stringify(payload)).then(calculated => { if (!cancelled) setProof({ calculated, valid: calculated === hash && entry.previousHash === (ledger[selected - 1]?.hash || 'GENESIS') }); })
        .catch(() => { if (!cancelled) setProof({ valid: false, error: true }); });
    }
    return () => { cancelled = true; };
  }, [entry, ledger, selected]);
  const exportProof = async action => {
    setExporting(action); setError(''); setFeedback(''); setCopyFallback('');
    try {
      const certificate = await buildLedgerCertificate(data);
      if (action === 'copy') {
        const summary = formatChainDigest(certificate);
        try {
          if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
          await navigator.clipboard.writeText(summary);
        } catch {
          setCopyFallback(summary);
          throw new Error('Clipboard access is unavailable. Select and copy the summary below.');
        }
        setFeedback('Chain digest and verification summary copied.');
      } else {
        downloadJson(certificate, `impactlens-${data.mode === 'sandbox' ? 'sandbox-' : ''}ledger-certificate.json`);
        setFeedback(certificate.verification.valid ? 'Verified ledger certificate downloaded.' : 'Ledger certificate downloaded with failed or unavailable verification clearly recorded.');
      }
    } catch (failure) { setError(failure.message); }
    finally { setExporting(null); }
  };
  return <Modal title="Evidence lineage & cryptographic proofs" titleId="provenance-heading" onClose={onClose} busy={Boolean(exporting)} wide>
    <div className="modal-body"><div className={`verification-banner ${data.verification?.valid ? 'valid' : ''}`}><ShieldCheck size={22} /><div><b>{data.verification?.valid ? ledger.length ? 'Ledger integrity verified' : 'Empty ledger · no registered evidence' : 'Ledger verification failed'}</b><p>{data.mode === 'sandbox' ? 'LOCAL SANDBOX · browser-only ledger.' : 'Server workspace ledger.'} {ledger.length} events. Integrity does not establish factual truth.{data.verification?.reason && ` ${data.verification.reason}`}</p></div></div>
      <div className="certificate-actions"><button className="secondary-btn" disabled={Boolean(exporting)} onClick={() => exportProof('copy')}><Copy size={15} />{exporting === 'copy' ? 'Copying…' : 'Copy Chain Digest'}</button><button className="secondary-btn" disabled={Boolean(exporting)} onClick={() => exportProof('download')}><Download size={15} />{exporting === 'download' ? 'Verifying certificate…' : 'Download Ledger Certificate (.json)'}</button></div>
      {feedback && <p className="certificate-feedback" role="status">{feedback}</p>}
      {error && <p className="upload-error" role="alert">{error}</p>}
      {copyFallback && <label className="control-field">Chain digest summary<textarea readOnly rows={7} value={copyFallback} onFocus={event => event.target.select()} /></label>}
      <p className="control-help">Select a lineage node to inspect its proof. Graph edges link evidence and claims; previousHash links every event in chronological order.</p>
      <div className="lineage-scroll" tabIndex={0} aria-label="Scrollable evidence lineage graph"><div className="lineage-graph" style={{ width: graph.width, height: graph.height }}><svg width={graph.width} height={graph.height} aria-hidden="true">{graph.nodes.flatMap(node => node.parents.map(parentId => { const parent = graph.positions.get(parentId); return <path key={`${parentId}-${node.id}`} d={`M ${parent.x + 204} ${parent.y + 28} C ${parent.x + 218} ${parent.y + 28}, ${node.x - 16} ${node.y + 28}, ${node.x} ${node.y + 28}`} />; }))}</svg><div className="lineage-node genesis" style={{ left: 16, top: 16 }}>GENESIS</div>{graph.nodes.map(node => <button key={node.id} className={`lineage-node ${selected === node.index ? 'selected' : ''}`} style={{ left: node.x, top: node.y }} aria-pressed={selected === node.index} onClick={() => setSelected(node.index)}><b>#{node.index + 1} · {node.entry.type}</b><small>{node.entry.claimId || node.entry.assetId}</small>{node.entry.demo && <small>ILLUSTRATIVE DEMO</small>}</button>)}</div></div>
      {entry && <section className="proof-panel"><label className="control-field">Inspect event<select value={selected} onChange={event => setSelected(Number(event.target.value))}>{ledger.map((event, index) => <option value={index} key={index}>#{index + 1} · {event.type} · {event.claimId || event.assetId}</option>)}</select></label><h3 className={proof && !proof.valid ? 'proof-failed' : ''}>{proof?.error ? 'Unable to recompute this block hash' : proof ? proof.valid ? 'Block hash and chronological link match' : 'Block proof mismatch' : 'Recomputing SHA-256…'}</h3><dl><dt>Actor / timestamp</dt><dd>{entry.actor || 'system'} · {entry.timestamp || 'Not recorded'}</dd><dt>Parent asset</dt><dd>{entry.parentAssetId || entry.parentAsset || '—'}</dd><dt>Annotation action</dt><dd>{entry.reason ? `${entry.reason} · ${entry.annotationId}` : entry.annotation ? `Recorded revision ${entry.annotation.revision || 1} · ${entry.annotation.id}` : '—'}</dd><dt>Exact transformation</dt><dd>{entry.transformation || '—'}</dd><dt>Description</dt><dd>{entry.description || '—'}</dd><dt>Previous hash</dt><dd><code>{entry.previousHash}</code></dd><dt>Stored hash</dt><dd><code>{entry.hash}</code></dd><dt>Recomputed hash</dt><dd><code>{proof?.calculated || '…'}</code></dd></dl><details><summary>Exact hashed payload (JSON)</summary><pre>{JSON.stringify(Object.fromEntries(Object.entries(entry).filter(([key]) => key !== 'hash')), null, 2)}</pre></details></section>}
    </div>
  </Modal>;
}
