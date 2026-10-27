'use client';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import type { Artist } from '@/lib/types';
import { Loader, Failure } from './ui';
import { Browse } from './browse';
export function Artists({ id }: { id?: string }) {
  const [artists, setArtists] = useState<Artist[]>([]); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [revision, setRevision] = useState(0);
  useEffect(() => { let active = true; setLoading(true); (id ? api<Artist>(`/artists/${id}`).then(a => [a]) : api<Artist[]>('/artists')).then(a => { if (active) { setArtists(a); setError(''); } }).catch(e => { if (active) setError(e.message); }).finally(() => { if (active) setLoading(false); }); return () => { active = false; }; }, [id, revision]);
  if (loading) return <Loader label="Meeting the artists…"/>; if (error) return <Failure message={error} retry={() => setRevision(revision + 1)}/>;
  if (id) { const artist = artists[0]; return <div className="container artist-profile"><Link href="/artists" className="text-link">All artists</Link><div className="artist-profile-heading"><span className="avatar avatar-large">{artist.avatar ? <img src={artist.avatar} alt=""/> : artist.name.split(' ').map(n => n[0]).join('')}</span><div><span className="eyebrow">The person behind the pieces</span><h1>{artist.name}</h1><p>{artist.bio || 'A member of the ArtHub artist community.'}</p></div></div><h2 className="artist-works-title">In the gallery</h2><Suspense fallback={<Loader/>}><Browse artistId={id}/></Suspense></div>; }
  return <div className="container artists-page"><div className="page-heading"><span className="eyebrow">A community of perspectives</span><h1>Meet the makers.</h1><p>Every piece has a story. These are the people who tell them.</p></div><div className="artist-grid">{artists.map((artist, i) => <Link key={artist._id} href={`/artists/${artist._id}`} className="artist-card"><div className="artist-cover"><img src={artist.image || '/artworks/met-436535.webp'} alt=""/><span className="artist-number">0{i + 1}</span></div><div className="artist-info"><span className={`avatar artist-avatar avatar-color-${i}`}>{artist.name.split(' ').map(n => n[0]).join('')}</span><div><h2>{artist.name}</h2><span>{artist.artworks} artworks · {artist.sales} sample sales</span></div></div><p className="artist-bio">{artist.bio}</p></Link>)}</div><div className="simple-callout"><h2>Your perspective belongs here, too.</h2><Link href="/register?role=artist" className="button">Join as an artist</Link></div></div>;
}
