'use client';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import type { Catalog } from '@/lib/types';
import { useAuth } from './providers';
type Tool = { name: string; title: string; description: string; inputSchema: object; annotations: { readOnlyHint: boolean; untrustedContentHint: boolean }; execute: (input: unknown) => Promise<unknown> };
type ModelContext = { registerTool: (tool: Tool, options: { signal: AbortSignal }) => void | Promise<void> };
export function AgentTools() {
  const { user, refresh } = useAuth();
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    const register = (tool: Tool) => { try { Promise.resolve(context.registerTool(tool, { signal: controller.signal })).catch(() => {}); } catch { /* Browser registry is optional. */ } };
    register({ name: 'search_arthub_artworks', title: 'Search ArtHub artworks', description: 'Read the public gallery using the same title and artist search as Browse artworks. Returns artwork IDs, titles, prices, availability, and links.', inputSchema: { type: 'object', properties: { search: { type: 'string', maxLength: 120 } }, additionalProperties: false }, annotations: { readOnlyHint: true, untrustedContentHint: true }, async execute(input) { if (!input || typeof input !== 'object') throw new Error('Provide a search object.'); const search = (input as { search?: unknown }).search; if (search !== undefined && (typeof search !== 'string' || search.length > 120)) throw new Error('Search must be a string of at most 120 characters.'); const result = await api<Catalog>(`/artworks?search=${encodeURIComponent(search || '')}`); return { total: result.total, artworks: result.items.map(a => ({ id: a._id, title: a.title, artist: a.artistName, price: a.price, sold: a.sold, demo: !!a.demo, path: `/artworks/${a._id}` })) }; } });
    if (user) register({ name: 'save_arthub_artwork', title: 'Save artwork to wishlist', description: 'Save one artwork to the currently signed-in account wishlist, using the same action as the heart button. Does not buy or reserve artwork.', inputSchema: { type: 'object', properties: { artworkId: { type: 'string', pattern: '^[a-fA-F0-9]{24}$' } }, required: ['artworkId'], additionalProperties: false }, annotations: { readOnlyHint: false, untrustedContentHint: false }, async execute(input) { const id = (input as { artworkId?: unknown })?.artworkId; if (typeof id !== 'string' || !/^[a-fA-F0-9]{24}$/.test(id)) throw new Error('Provide a valid artwork ID.'); await api(`/wishlist/${id}`, { method: 'POST' }); await refresh(); return { saved: true, artworkId: id }; } });
    return () => controller.abort();
  }, [user?._id, refresh]);
  return null;
}
