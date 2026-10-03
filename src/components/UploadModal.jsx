import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { demoAssets } from '../data/demo.js';
import Modal from './Modal.jsx';

export default function UploadModal({ status, onClose, onUpload, busy }) {
  const [image, setImage] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [demo, setDemo] = useState(false);
  const [storage, setStorage] = useState(status.cloudinary ? 'cloudinary' : 'local');
  const [analyze, setAnalyze] = useState(false);
  const [error, setError] = useState('');
  const [reading, setReading] = useState(false);
  const input = useRef(null);
  const readImage = file => {
    if (!file) return;
    setError('');
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) return setError('Choose a PNG, JPEG, WebP or GIF image.');
    if (file.size > 10 * 1024 * 1024) return setError('Choose an image smaller than 10 MB.');
    setReading(true);
    const reader = new FileReader();
    reader.onload = () => { setImage(reader.result); setName(file.name); setDemo(false); setReading(false); };
    reader.onerror = () => { setError('Could not read this image. Please select it again.'); setReading(false); };
    reader.readAsDataURL(file);
  };
  const submit = async event => {
    event.preventDefault(); setError('');
    try { await onUpload({ image, name: name || 'evidence-image', location, storage, demo }, analyze); }
    catch (failure) { setError(failure.message); }
  };
  const locked = Boolean(busy || reading);
  return <Modal title="Upload evidence asset" titleId="upload-heading" onClose={onClose} busy={locked}>
    <form onSubmit={submit}><div className="modal-body">
      {error && <div className="upload-error" role="alert">{error}</div>}
      <label className="control-field">Save to<select value={storage} onChange={event => setStorage(event.target.value)} disabled={locked}><option value="local">{status.mode === 'sandbox' ? 'Browser sandbox' : 'Local server workspace'}</option><option value="cloudinary" disabled={status.mode === 'sandbox'}>Cloudinary</option></select></label>
      <p className="control-help">{status.mode === 'sandbox' ? status.persistent ? 'Stored in this browser only. Large files can exceed browser storage capacity.' : 'Session-only sandbox: browser storage is unavailable.' : storage === 'local' ? 'Persisted by the API in .data/impactlens.json.' : 'Uploads use server-side Cloudinary credentials.'}</p>
      <button type="button" className="dropzone" disabled={locked} onClick={() => input.current?.click()} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (!locked) readImage(event.dataTransfer.files?.[0]); }}><Upload size={24} /><b>Choose an image or drop it here</b><small>PNG, JPEG, WebP, GIF · up to 10 MB</small></button>
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={event => readImage(event.target.files?.[0])} />
      <label className="control-field">Or image URL<input type="url" disabled={locked} value={image.startsWith('data:') ? '' : image} onChange={event => { setImage(event.target.value); setDemo(false); }} placeholder="https://…" /></label>
      <div className="demo-presets"><span className="eyebrow">ILLUSTRATIVE DEMO PRESETS</span>{demoAssets.map(asset => <button type="button" key={asset.id} className="pill" disabled={locked} onClick={() => { setImage(asset.image); setName(asset.name); setLocation(asset.location); setDemo(true); }}>{asset.elements[0]}</button>)}</div>
      {image && <div className="upload-preview"><img src={image} alt="Selected upload preview" />{demo && <span className="pill">ILLUSTRATIVE DEMO</span>}</div>}
      <label className="control-field">Asset filename<input value={name} onChange={event => setName(event.target.value)} disabled={locked} maxLength={200} /></label>
      <label className="control-field">Field location<input value={location} onChange={event => setLocation(event.target.value)} disabled={locked} maxLength={200} /></label>
      <label className="checkbox-label"><input type="checkbox" checked={analyze} onChange={event => setAnalyze(event.target.checked)} disabled={locked} />{status.mode === 'sandbox' ? 'Run illustrative simulation after saving' : status.mockVision ? 'Analyze after saving (mock fallback enabled)' : 'Analyze with OpenAI after saving'}</label>
    </div><div className="modal-footer"><button type="button" className="secondary-btn" onClick={onClose} disabled={locked}>Cancel</button><button className="upload-btn" disabled={locked || !image}>{reading ? 'Reading image…' : busy || 'Save evidence'}</button></div></form>
  </Modal>;
}
