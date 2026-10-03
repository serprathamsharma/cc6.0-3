import { cloneElement } from 'react';

export default function ChainStep({ icon, label, detail, active }) {
  return <div className={`chain-step ${active ? 'active' : 'muted'}`}><div className="chain-icon">{cloneElement(icon, { size: 16 })}</div><div><small>{label}</small><b>{detail}</b></div></div>;
}
