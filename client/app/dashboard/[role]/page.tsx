import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { Dashboard } from '@/components/dashboard';
import { Loader } from '@/components/ui';
import type { Role } from '@/lib/types';
export const metadata = { title: 'Your dashboard' };
export default async function Page({ params }: { params: Promise<{ role: string }> }) { const { role } = await params; if (!['user','artist','admin'].includes(role)) notFound(); return <Suspense fallback={<Loader/>}><Dashboard role={role as Role}/></Suspense>; }
