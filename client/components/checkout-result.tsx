'use client';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Check, X, Clock } from 'lucide-react';
import { api, body } from '@/lib/api';
import { useAuth } from './providers';
import { Protected } from './protected';
function Result({ canceled }: { canceled: boolean }) {
  const params = useSearchParams(); const sessionId = params.get('session_id'); const { refresh } = useAuth(); const [status, setStatus] = useState(canceled ? 'canceled' : 'checking'); const [message, setMessage] = useState('');
  useEffect(() => { if (!sessionId) { if (!canceled) { setStatus('error'); setMessage('There is no checkout session to verify.'); } return; } let stopped = false; let timer: ReturnType<typeof setTimeout>; let attempts = 0;
    async function check() { try { if (canceled) { await api('/checkout/cancel', { method: 'POST', body: body({ sessionId }) }); return; } const result = await api<{ status: string }>(`/checkout/status?session_id=${encodeURIComponent(sessionId!)}`); if (stopped) return; if (result.status === 'completed') { setStatus('completed'); void refresh(); } else if (++attempts < 6) timer = setTimeout(check, 2000); else setStatus('pending'); } catch (e) { if (!stopped) { setStatus('error'); setMessage((e as Error).message); } } }
    void check(); return () => { stopped = true; clearTimeout(timer); };
  }, [sessionId, canceled, refresh]);
  const success = status === 'completed';
  return <div className="container checkout-result"><span className="checkout-icon">{success ? <Check size={32}/> : canceled ? <X size={28}/> : <Clock size={30}/>}</span><h1>{success ? 'A new chapter for your collection.' : canceled ? 'A little more time to decide.' : status === 'checking' ? 'Confirming your checkout…' : status === 'pending' ? 'Your payment is still processing.' : 'We couldn’t confirm this checkout.'}</h1><p>{success ? 'Your payment has been verified and your dashboard is up to date.' : canceled && status !== 'error' ? 'Checkout was canceled. Browse the gallery whenever you’re ready.' : message || 'We’ll update your collection as soon as payment is confirmed. Check your dashboard for the latest status.'}</p><div className="checkout-links"><Link href="/dashboard/user" className="button">My dashboard</Link><Link href="/browse" className="button button-outline">Back to the gallery</Link></div></div>;
}
export function CheckoutResult({ canceled = false }: { canceled?: boolean }) { return <Protected role="user"><Result canceled={canceled}/></Protected>; }
