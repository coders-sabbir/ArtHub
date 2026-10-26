'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, body } from '@/lib/api';
import type { User } from '@/lib/types';
import { useAuth } from '@/components/providers';
import { Loader } from '@/components/ui';
export default function Page() {
  const router = useRouter(); const { setUser } = useAuth(); const [error, setError] = useState('');
  useEffect(() => { const role = sessionStorage.getItem('arthub_google_role') || 'user'; const next = sessionStorage.getItem('arthub_google_next'); api<User>('/auth/google-session', { method: 'POST', body: body({ role }) }).then(person => { setUser(person); sessionStorage.removeItem('arthub_google_role'); sessionStorage.removeItem('arthub_google_next'); router.replace(next?.startsWith('/') && !next.startsWith('//') ? next : person.role === 'user' ? '/' : `/dashboard/${person.role}`); }).catch(e => setError(e.message)); }, [router, setUser]);
  return error ? <div className="container empty-state"><h1>We couldn’t complete sign-in</h1><p>{error}</p><Link href="/login" className="button">Back to sign in</Link></div> : <Loader label="Welcoming you to the gallery…"/>;
}
