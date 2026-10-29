'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Sparkles } from 'lucide-react';
import { useAuth, useToast } from './providers';
import { api, body } from '@/lib/api';
const plans = [
  { id: 'free', title: 'A first impression', price: '0', limit: 'Collect up to 3 artworks', features: ['Explore the entire gallery', 'Save your favorite pieces', 'Join collector conversations'] },
  { id: 'pro', title: 'Room for inspiration', price: '9.99', limit: 'Collect up to 9 artworks', features: ['Everything in Free', 'More space for your collection', 'Manage your subscription anytime'] },
  { id: 'premium', title: 'A world of possibility', price: '19.99', limit: 'Unlimited artwork purchases', features: ['Everything in Pro', 'Collect without a purchase limit', 'Manage your subscription anytime'] },
];
export function Membership({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth(); const notify = useToast(); const router = useRouter(); const [busy, setBusy] = useState('');
  async function select(tier: string) { if (!user) return router.push('/register?next=/membership'); if (user.role !== 'user') return notify('Membership plans are for buyer accounts.', true); if (tier === 'free') return router.push('/browse'); setBusy(tier); try { const data = await api<{ url: string }>(user.stripeSubscriptionId ? '/billing/portal' : '/checkout', { method: 'POST', body: body({ type: 'subscription', tier }) }); window.location.assign(data.url); } catch (e) { notify((e as Error).message, true); setBusy(''); } }
  return <div className={compact ? 'membership-content' : 'container membership-page'}>{!compact && <div className="page-heading centered"><span className="eyebrow">Make room for what you love</span><h1>A collection that grows with you.</h1><p>Find your pace. Follow your curiosity.</p></div>}<div className="plan-grid">{plans.map(plan => <article className={`plan-card ${plan.id === 'pro' ? 'featured-plan' : ''}`} key={plan.id}>{plan.id === 'pro' && <span className="plan-recommended"><Sparkles size={14}/>For the curious collector</span>}<span className="eyebrow">{plan.id}</span><h2>{plan.title}</h2><p className="plan-price">${plan.price}<span>{plan.id === 'free' ? 'forever' : '/ month'}</span></p><strong className="plan-limit">{plan.limit}</strong><ul>{plan.features.map(f => <li key={f}><Check size={16}/>{f}</li>)}</ul><button className={`button ${plan.id === 'pro' ? '' : 'button-outline'}`} disabled={!!busy || user?.subscriptionTier === plan.id} onClick={() => select(plan.id)}>{busy === plan.id ? 'Opening checkout…' : user?.subscriptionTier === plan.id ? 'Your current plan' : user?.stripeSubscriptionId && plan.id !== 'free' ? 'Manage membership' : plan.id === 'free' ? 'Start exploring' : `Choose ${plan.id === 'pro' ? 'Pro' : 'Premium'}`}</button></article>)}</div><p className="plan-disclaimer">Artwork prices are separate. Purchase allowances apply to your total collection, including previous purchases. Paid memberships renew monthly until canceled.</p></div>;
}
