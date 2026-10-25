import { Suspense } from 'react';
import { AuthForm } from '@/components/auth-form';
import { Loader } from '@/components/ui';
export const metadata = { title: 'Join ArtHub' };
export default function Page() { return <Suspense fallback={<Loader/>}><AuthForm register/></Suspense>; }
