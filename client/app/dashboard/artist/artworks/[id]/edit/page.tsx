import { ArtworkForm } from '@/components/artwork-form';
export const metadata = { title: 'Edit artwork' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <ArtworkForm id={id}/>; }
