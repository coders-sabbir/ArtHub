import { Suspense } from 'react';
import { CheckoutResult } from '@/components/checkout-result';
import { Loader } from '@/components/ui';
export const metadata = { title: 'Checkout confirmation' };
export default function Page() { return <Suspense fallback={<Loader/>}><CheckoutResult/></Suspense>; }
