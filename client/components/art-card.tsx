'use client';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useAuth, useToast } from './providers';
import { AddToCart } from './cart';
import { api } from '@/lib/api';
import { Artwork, money } from '@/lib/types';
export function ArtCard({ artwork, onSave, showCart = false }: { artwork: Artwork; onSave?: () => void; showCart?: boolean }) {
  const { user, refresh } = useAuth(); const notify = useToast(); const router = useRouter(); const [busy, setBusy] = useState(false);
  const saved = user?.wishlist?.includes(artwork._id);
  const save = async () => { if (!user) { router.push(`/login?next=${encodeURIComponent('/wishlist')}`); return; } setBusy(true); try { await api(`/wishlist/${artwork._id}`, { method: saved ? 'DELETE' : 'POST' }); await refresh(); onSave?.(); notify(saved ? 'Removed from your saved artworks.' : 'Saved to your wishlist.'); } catch (error) { notify((error as Error).message, true); } finally { setBusy(false); } };
  return <article className="art-card"><div className="art-image-wrap"><Link href={`/artworks/${artwork._id}`} tabIndex={-1} aria-hidden="true"><img src={artwork.image} alt={artwork.title} loading="lazy"/></Link>{artwork.sold ? <span className="art-badge">Sold</span> : <span className="art-category">{artwork.demo ? 'Preview · ' : ''}{artwork.category}</span>}<button className={`save-button ${saved ? 'saved' : ''}`} onClick={save} disabled={busy} aria-label={saved ? `Unsave ${artwork.title}` : `Save ${artwork.title}`} aria-pressed={!!saved}><Heart size={18} fill={saved ? 'currentColor' : 'none'}/></button></div><div className="art-card-info"><div><Link href={`/artworks/${artwork._id}`} className="art-title">{artwork.title}</Link><Link href={`/artists/${artwork.artistId}`} className="art-artist">{artwork.artistName}</Link></div><span className="art-price">{money(artwork.price)}</span></div>{showCart && <AddToCart artwork={artwork}/>}</article>;
}
