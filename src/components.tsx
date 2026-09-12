import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

type CatVariant = 'default' | 'sleepy' | 'sticker' | 'workspace' | 'task' | 'collection' | 'timer' | 'timer-running' | 'sidebar' | 'faq' | 'cta';

export function BrandLogo() {
  return <img className="brand-logo" src="/brand/tabby/tabby-logo.svg" width="139" height="40" alt="Tabby" />;
}

export function Cat({ size = 32, sleepy = false, variant, className = '' }: { size?: number; sleepy?: boolean; variant?: CatVariant; className?: string }) {
  const selected = variant ?? (sleepy ? 'sleepy' : 'default');
  const suffix = selected === 'default' ? '' : `-${selected}`;
  return <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true"><image href={`/brand/tabby/tabby-mark${suffix}.svg`} width="64" height="64" /></svg>;
}

export function ChromeIcon({ size = 20 }: { size?: number }) {
  // Use the supplied silhouette while retaining the surrounding button's contrast.
  return <svg width={size} height={size} aria-hidden="true" style={{ backgroundColor: 'currentColor', mask: 'url("/brand/services/google-chrome.svg") center / contain no-repeat' }} />;
}

const serviceAssets: Record<string, string> = {
  notion: 'notion', gmail: 'gmail', linear: 'linear', slack: 'slack', figma: 'figma', calendar: 'google-calendar', todoist: 'todoist',
};

export function ToolIcon({ name, size = 28 }: { name: string; size?: number }) {
  const asset = Object.hasOwn(serviceAssets, name) ? serviceAssets[name] : null;
  return <span className={`tool-icon tool-${name}`} style={{ width: size, height: size }} aria-hidden="true">{asset ? <img src={`/brand/services/${asset}.svg`} width={size} height={size} alt="" /> : <Cat size={size} variant="task" />}</span>;
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
