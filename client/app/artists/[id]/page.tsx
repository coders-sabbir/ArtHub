import { Artists } from '@/components/artists';
export const metadata = { title: 'Artist gallery' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <Artists id={id}/>; }
