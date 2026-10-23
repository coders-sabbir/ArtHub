import { Suspense } from 'react';
import { Browse } from '@/components/browse';
import { Loader } from '@/components/ui';
export const metadata = { title: 'Browse artworks' };
export default function Page() { return <Suspense fallback={<Loader/>}><Browse/></Suspense>; }
