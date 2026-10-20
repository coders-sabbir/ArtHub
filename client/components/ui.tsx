'use client';
import { useEffect, useRef } from 'react';
import { X, Search, ImageOff, RotateCcw } from 'lucide-react';
import Link from 'next/link';
export function Loader({ label = 'Finding your next inspiration…' }: { label?: string }) { return <div className="loading-screen" role="status"><span className="spinner"/><span>{label}</span></div>; }
export function SkeletonGrid({ count = 8 }: { count?: number }) { return <div className="art-grid" aria-label="Loading artworks" aria-busy="true">{Array.from({ length: count }, (_, i) => <div className="skeleton-card" key={i}><div className="skeleton skeleton-image"/><div className="skeleton skeleton-line"/><div className="skeleton skeleton-line short"/></div>)}</div>; }
export function Empty({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) { return <div className="empty-state"><span className="empty-icon"><Search size={30}/></span><h3>{title}</h3><p>{description}</p>{action}</div>; }
export function Failure({ message, retry }: { message: string; retry: () => void }) { return <div className="empty-state" role="alert"><ImageOff size={32}/><h3>We couldn’t load this collection</h3><p>{message}</p><button className="button button-outline" onClick={retry}><RotateCcw size={16}/>Try again</button></div>; }
export function Modal({ title, children, close }: { title: string; children: React.ReactNode; close: () => void }) {
  const ref = useRef<HTMLDivElement>(null); const closeRef = useRef(close); closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement; const overflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const targets = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button, a, input, textarea, select, [tabindex="0"]') || []);
    targets()[0]?.focus();
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') closeRef.current(); if (e.key === 'Tab') { const items = targets(); const first = items[0]; const last = items[items.length - 1]; if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); } } };
    document.addEventListener('keydown', key);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', key); previous?.focus(); };
  }, []);
  return <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) close(); }}><div ref={ref} className="modal" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><h2>{title}</h2><button onClick={close} className="icon-button" aria-label="Close dialog"><X/></button></div>{children}</div></div>;
}
export function NotFoundContent() { return <div className="not-found container"><span className="eyebrow">A little off the canvas</span><div className="error-number">404<span>✳</span></div><h1>Page Not Found</h1><p>This corner of the gallery is empty.<br/>Let’s find something worth looking at.</p><Link href="/" className="button">Back to home</Link></div>; }
