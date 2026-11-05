'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingCart, Trash2 } from 'lucide-react';
import { api, body } from '@/lib/api';
import { Artwork, money } from '@/lib/types';
import { useAuth, useToast } from './providers';
import { Empty, Failure, PaymentLoading, SkeletonGrid } from './ui';

export function AddToCart({ artwork }: { artwork: Artwork }) {
  const { user, refresh } = useAuth();
  const notify = useToast();
  const [busy, setBusy] = useState(false);
  const inCart = user?.cart?.includes(artwork._id);
  async function add() {
    setBusy(true);
    try {
      await api(`/cart/${artwork._id}`, { method: 'POST' });
      await refresh();
      notify('Artwork added to your cart.');
    } catch (error) { notify((error as Error).message, true); }
    finally { setBusy(false); }
  }
  if (inCart) return <Link href="/cart" className="button button-outline cart-card-action"><ShoppingCart size={16}/>View cart</Link>;
  const unavailable = artwork.sold || artwork.demo || user?.role !== 'user';
  return <button className="button button-outline cart-card-action" disabled={busy || unavailable} onClick={add}><ShoppingCart size={16}/>{busy ? 'Adding…' : artwork.sold ? 'Sold' : artwork.demo ? 'Preview only' : user?.role !== 'user' ? 'Buyer accounts only' : 'Add to Cart'}</button>;
}

export function Cart() {
  const { user, refresh } = useAuth();
  const notify = useToast();
  const [items, setItems] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState('');
  const [redirecting, setRedirecting] = useState(false);
  useEffect(() => {
    let active = true; setLoading(true);
    api<Artwork[]>('/cart').then(data => { if (active) { setItems(data); setError(''); } })
      .catch(error => { if (active) { setError(error.message); notify(error.message, true); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [user?._id, revision, notify]);
  async function remove(id: string) {
    setBusy(id);
    try { await api(`/cart/${id}`, { method: 'DELETE' }); await refresh(); setRevision(value => value + 1); }
    catch (error) { notify((error as Error).message, true); }
    finally { setBusy(''); }
  }
  async function checkout(id: string) {
    setBusy(id); setRedirecting(true);
    try {
      const result = await api<{ url: string }>('/checkout', { method: 'POST', body: body({ type: 'purchase', artworkId: id }) });
      window.location.assign(result.url);
    } catch (error) { notify((error as Error).message, true); setBusy(''); setRedirecting(false); }
  }
  return <div className="container wishlist-page">
    {redirecting && <PaymentLoading/>}
    <div className="page-heading"><span className="eyebrow">A place in your collection</span><h1>Your cart.</h1><p>Check out one original at a time. Availability and your purchase allowance are confirmed at checkout.</p></div>
    {loading ? <SkeletonGrid count={3}/> : error ? <Failure message={error} retry={() => setRevision(value => value + 1)}/> : !items.length ? <Empty title="Your next discovery is waiting." description="Add an available original from your wishlist to start collecting." action={<Link href="/wishlist" className="button">My wishlist</Link>}/> : <div className="art-grid">{items.map(artwork => <article className="art-card" key={artwork._id}>
      <Link href={`/artworks/${artwork._id}`} className="cart-image"><img src={artwork.image} alt={artwork.title}/></Link>
      <div className="art-card-info"><div><Link className="art-title" href={`/artworks/${artwork._id}`}>{artwork.title}</Link><span className="art-artist">{artwork.artistName}</span></div><span className="art-price">{money(artwork.price)}</span></div>
      <div className="cart-actions"><button className="button" disabled={!!busy || artwork.sold || artwork.demo} onClick={() => checkout(artwork._id)}>{artwork.sold ? 'Sold' : artwork.demo ? 'Preview only' : 'Checkout'}</button><button className="icon-button" disabled={!!busy} aria-label={`Remove ${artwork.title} from cart`} onClick={() => remove(artwork._id)}><Trash2 size={18}/></button></div>
    </article>)}</div>}
  </div>;
}
