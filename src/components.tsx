import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export function Cat({ size = 32, sleepy = false, className = '' }: { size?: number; sleepy?: boolean; className?: string }) {
  return <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true"><path d="M8 38V9.5c0-1.3 1.5-2 2.5-1.2L26 20c4-1 8-1 12 0L53.5 8.3c1-.8 2.5-.1 2.5 1.2V38c0 15-10 21-24 21S8 53 8 38Z" fill="currentColor" />{sleepy ? <><path d="m18 35 6 3 6-3m5 0 6 3 6-3" stroke="var(--cat-eyes, #f6f5f0)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" /></> : <><rect x="20" y="31" width="5" height="10" rx="2.5" fill="var(--cat-eyes, #f6f5f0)" /><rect x="39" y="31" width="5" height="10" rx="2.5" fill="var(--cat-eyes, #f6f5f0)" /></>}<path d="m28 47 4 3 4-3" stroke="var(--cat-eyes, #f6f5f0)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function ChromeIcon({ size = 20 }: { size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9.5" stroke="currentColor" strokeWidth="1.7" /><circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.7" /><path d="M12 8h8.7M8.6 14l-4.4-7.6m11.2 7.8-4.2 7.3" stroke="currentColor" strokeWidth="1.7" /></svg>;
}

export function ToolIcon({ name, size = 28 }: { name: string; size?: number }) {
  return <span className={`tool-icon tool-${name}`} style={{ width: size, height: size, fontSize: size * .62 }} aria-hidden="true">{name === 'notion' ? <b>N</b> : name === 'gmail' ? <svg viewBox="0 0 24 24" fill="none"><path d="M3 18V6l9 7 9-7v12" stroke="#4285f4" strokeWidth="3" strokeLinejoin="round" /><path d="M3 6l9 7 9-7" stroke="#ea4335" strokeWidth="3" strokeLinejoin="round" /><path d="M21 9v9" stroke="#34a853" strokeWidth="3" /><path d="M3 9v9" stroke="#fbbc04" strokeWidth="3" /></svg> : name === 'linear' ? <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#7774e6" /><path d="m3 8.1 12.9 12.9M2 12.5l9.5 9.5M3 17.4l3.6 3.6" stroke="#fff" strokeWidth="1.7" /></svg> : name === 'slack' ? <svg viewBox="0 0 24 24" fill="none" strokeWidth="4" strokeLinecap="round"><path d="M9 3v7M3 9h1" stroke="#36c5f0" /><path d="M21 9h-7M15 3v1" stroke="#2eb67d" /><path d="M15 21v-7M21 15h-1" stroke="#ecb22e" /><path d="M3 15h7M9 21v-1" stroke="#e01e5a" /></svg> : name === 'figma' ? <svg viewBox="0 0 24 24"><rect x="5" y="2" width="8" height="7" rx="3.5" fill="#f24e1e" /><rect x="12" y="2" width="7" height="7" rx="3.5" fill="#ff7262" /><rect x="5" y="9" width="8" height="7" rx="3.5" fill="#a259ff" /><circle cx="15.5" cy="12.5" r="3.5" fill="#1abcfe" /><path d="M12 16H8.5a3.5 3.5 0 1 0 3.5 3.5Z" fill="#0acf83" /></svg> : name === 'calendar' ? <svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" fill="#4285f4" /><path d="M3 9h18v10H3Z" fill="#fff" /><path d="M7 2v5m10-5v5" stroke="#1967d2" strokeWidth="2" /><text x="12" y="17" textAnchor="middle" fontSize="9" fontFamily="Arial" fill="#4285f4">31</text></svg> : name === 'todoist' ? <svg viewBox="0 0 24 24"><rect width="24" height="24" rx="5" fill="#e75c4c" /><path d="m5 8 3 2 11-5M5 13l3 2 11-5M5 18l3 2 11-5" fill="none" stroke="white" strokeWidth="1.6" /></svg> : <Cat size={size} />}</span>;
}

export function Modal({ open, onClose, children, className = '', label }: { open: boolean; onClose: () => void; children: ReactNode; className?: string; label: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const dialog = ref.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { dialog?.close(); document.body.style.overflow = overflow; previousFocus?.focus(); };
  }, [open]);
  return <dialog ref={ref} className={`modal ${className}`} aria-label={label} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose(); }}><div className="modal-interior"><button autoFocus className="modal-close" onClick={onClose} aria-label="Close dialog"><X size={20} /></button>{open && children}</div></dialog>;
}
