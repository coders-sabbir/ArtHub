import type { Metadata } from 'next';
import { Providers } from '@/components/providers';
import { Navigation, Footer } from '@/components/shell';
import { AgentTools } from '@/components/agent-tools';
import './globals.css';
export const metadata: Metadata = { title: { default: 'ArtHub — Art that speaks to you', template: '%s | ArtHub' }, description: 'Discover original artwork, meet independent artists, and build a collection that feels like you.', icons: { icon: '/favicon.svg' } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" suppressHydrationWarning><body><Providers><AgentTools/><Navigation/><main id="main-content">{children}</main><Footer/></Providers></body></html>;
}
