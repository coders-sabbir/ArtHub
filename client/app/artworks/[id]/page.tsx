import { ArtworkDetail } from '@/components/artwork-detail';
export const metadata = { title: 'A closer look' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <ArtworkDetail id={id}/>; }
