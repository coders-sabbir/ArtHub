'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Artwork } from '@/lib/types';
import { Protected } from '@/components/protected';
import { ArtCard } from '@/components/art-card';
import { SkeletonGrid, Empty, Failure } from '@/components/ui';
import { useAuth, useToast } from '@/components/providers';
function Wishlist() { const notify = useToast(); const { user } = useAuth(); const [items, setItems] = useState<Artwork[]>([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [revision, setRevision] = useState(0); useEffect(() => { let active = true; if (!user) return; api<Artwork[]>('/wishlist').then(a => { if (active) { setItems(a); setError(''); } }).catch(e => { if (active) { setError(e.message); notify(e.message, true); } }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [user, revision, notify]); return <div className="container wishlist-page"><div className="page-heading"><span className="eyebrow">Keep a little inspiration close</span><h1>Your saved pieces.</h1><p>The artworks you keep coming back to.</p></div>{loading ? <SkeletonGrid/> : error ? <Failure message={error} retry={() => setRevision(revision + 1)}/> : items.length ? <div className="art-grid">{items.map(a => <ArtCard showCart key={a._id} artwork={a} onSave={() => setRevision(revision + 1)}/>)}</div> : <Empty title="Something will catch your eye." description="Save a piece with the heart icon and find it here whenever you need a little inspiration." action={<Link href="/browse" className="button">Explore the collection</Link>}/>}</div>; }
export default function Page() { return <Protected><Wishlist/></Protected>; }
