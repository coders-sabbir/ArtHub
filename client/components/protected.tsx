'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from './providers';
import { Loader, Failure } from './ui';
import type { Role } from '@/lib/types';
export function Protected({ children, role }: { children: React.ReactNode; role?: Role }) {
  const { user, loading, sessionError, refresh } = useAuth(); const router = useRouter(); const path = usePathname();
  useEffect(() => { if (!loading && !sessionError && !user) router.replace(`/login?next=${encodeURIComponent(path)}`); }, [user, loading, sessionError, router, path]);
  if (loading) return <Loader label="Opening your gallery…"/>;
  if (sessionError) return <Failure message="We couldn’t verify your session. Please try again." retry={() => void refresh()}/>;
  if (!user) return <Loader label="Taking you to sign in…"/>;
  if (role && user.role !== role) return <div className="container empty-state"><h1>This gallery belongs to another role.</h1><p>Open the dashboard for your account.</p><Link href={`/dashboard/${user.role}`} className="button">My dashboard</Link></div>;
  return <>{children}</>;
}
