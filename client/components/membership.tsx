'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Sparkles } from 'lucide-react';
import { useAuth, useToast } from './providers';
import { PaymentLoading } from './ui';
import { api, body } from '@/lib/api';
const plans = [
  { id: 'free', name: 'Free', maxPurchases: '3 paintings', title: 'A first impression', price: '0', limit: 'Collect up to 3 artworks', features: ['Explore the entire gallery', 'Save your favorite pieces', 'Join collector conversations'] },
  { id: 'pro', name: 'Pro', maxPurchases: '9 paintings', title: 'Room for inspiration', price: '9.99', limit: 'Collect up to 9 artworks', features: ['Everything in Free', 'More space for your collection', 'Manage your subscription anytime'] },
  { id: 'premium', name: 'Premium', maxPurchases: 'Unlimited', title: 'A world of possibility', price: '19.99', limit: 'Unlimited artwork purchases', features: ['Everything in Pro', 'Collect without a purchase limit', 'Manage your subscription anytime'] },
];
export function SubscriptionOverview() {
  const { user } = useAuth();
  return <section className="dashboard-panel" aria-labelledby="subscription-overview">
    <div className="panel-heading"><h2 id="subscription-overview">Subscription tier overview</h2><Link href="/dashboard/user?tab=membership">Manage membership</Link></div>
    <div className="table-wrap"><table><thead><tr><th>Tier</th><th>Max purchases allowed</th><th>Price</th></tr></thead><tbody>{plans.map(plan => <tr key={plan.id}>
      <td><strong>{plan.name}{plan.id === 'free' && ' (Default)'}</strong>{user?.subscriptionTier === plan.id && <span className="table-subtext">Your current plan</span>}</td><td>{plan.maxPurchases}</td><td className="nowrap">${plan.price}{plan.id !== 'free' && ' / month'}</td>
    </tr>)}</tbody></table></div>
    <p className="buyer-section-description">Artwork prices are separate. Purchase limits include your previous purchases.</p>
  </section>;
}
export function Membership({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth(); const notify = useToast(); const router = useRouter(); const [busy, setBusy] = useState('');
  async function select(tier: string) { if (!user) return router.push('/register?next=/membership'); if (user.role !== 'user') return notify('Membership plans are for buyer accounts.', true); if (tier === 'free') return router.push('/browse'); setBusy(tier); try { const data = await api<{ url: string }>(user.stripeSubscriptionId ? '/billing/portal' : '/checkout', { method: 'POST', body: body({ type: 'subscription', tier }) }); window.location.assign(data.url); } catch (e) { notify((e as Error).message, true); setBusy(''); } }
  return <div className={compact ? 'membership-content' : 'container membership-page'}>{busy && <PaymentLoading label={user?.stripeSubscriptionId ? 'Opening membership management…' : 'Opening secure checkout…'}/>}{!compact && <div className="page-heading centered"><span className="eyebrow">Make room for what you love</span><h1>Membership pricing.</h1><p>Compare Free, Pro and Premium plans for your collection.</p></div>}<div className="plan-grid">{plans.map(plan => <article className={`plan-card ${plan.id === 'pro' ? 'featured-plan' : ''}`} key={plan.id}>{plan.id === 'pro' && <span className="plan-recommended"><Sparkles size={14}/>For the curious collector</span>}<span className="eyebrow">{plan.name}</span><h2>{plan.title}</h2><p className="plan-price">${plan.price}<span>{plan.id === 'free' ? 'forever' : '/ month'}</span></p><strong className="plan-limit">{plan.limit}</strong><ul>{plan.features.map(f => <li key={f}><Check size={16}/>{f}</li>)}</ul><button className={`button ${plan.id === 'pro' ? '' : 'button-outline'}`} disabled={!!busy || user?.subscriptionTier === plan.id} onClick={() => select(plan.id)}>{busy === plan.id ? 'Opening checkout…' : user?.subscriptionTier === plan.id ? 'Your current plan' : user?.stripeSubscriptionId && plan.id !== 'free' ? 'Manage membership' : plan.id === 'free' ? 'Start exploring' : `Choose ${plan.id === 'pro' ? 'Pro' : 'Premium'}`}</button></article>)}</div><p className="plan-disclaimer">Artwork prices are separate. Purchase allowances apply to your total collection, including previous purchases. Paid memberships renew monthly until canceled.</p></div>;
}
