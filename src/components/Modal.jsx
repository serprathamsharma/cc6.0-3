import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export default function Modal({ title, titleId, onClose, children, wide = false, busy = false }) {
  const ref = useRef(null);
  const controls = useRef({ onClose, busy });
  controls.current = { onClose, busy };
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    const focusable = () => [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')].filter(node => node.getClientRects().length);
    (focusable()[0] || dialog).focus();
    const key = event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (!controls.current.busy) controls.current.onClose(); }
      if (event.key === 'Tab') {
        const nodes = focusable();
        const first = nodes[0], last = nodes.at(-1);
        if (!first) { event.preventDefault(); dialog.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    dialog.addEventListener('keydown', key);
    return () => { dialog.removeEventListener('keydown', key); previous?.focus(); };
  }, []);
  return <div className="modal-overlay" onClick={() => !busy && onClose()}>
    <section ref={ref} tabIndex={-1} className={`modal-dialog ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={event => event.stopPropagation()}>
      <div className="modal-header"><h2 id={titleId}>{title}</h2><button onClick={onClose} disabled={busy} aria-label={`Close ${title}`}><X size={18} /></button></div>
      {children}
    </section>
  </div>;
}
