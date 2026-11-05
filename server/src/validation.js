import { z } from 'zod';
export const categories = ['Painting', 'Digital', 'Sculpture', 'Photography', 'Printmaking'];
const email = z.string().trim().email().max(254).transform(v => v.toLowerCase());
const password = z.string().min(8, 'Use at least 8 characters.').max(128).regex(/[A-Z]/, 'Add an uppercase letter.').regex(/[a-z]/, 'Add a lowercase letter.').regex(/[0-9]/, 'Add a number.');
export const registration = z.object({ name: z.string().trim().min(2).max(80), email, password, confirmPassword: z.string(), role: z.enum(['user', 'artist']) }).refine(v => v.password === v.confirmPassword, { message: 'Passwords do not match.', path: ['confirmPassword'] });
export const login = z.object({ email, password: z.string().min(1).max(128) });
export const profile = z.object({ name: z.string().trim().min(2).max(80), bio: z.string().trim().max(500).optional(), avatar: z.string().url().max(2000).optional().or(z.literal('')) });
export const passwordChange = z.object({ currentPassword: z.string().min(1).max(128), password, confirmPassword: z.string() }).refine(v => v.password === v.confirmPassword, { message: 'Passwords do not match.' });
export const artwork = z.object({ title: z.string().trim().min(2).max(120), description: z.string().trim().min(20).max(5000), price: z.number().min(1).max(1000000).refine(v => Math.abs(v * 100 - Math.round(v * 100)) < 0.00001, 'Use at most two decimal places.'), category: z.enum(categories), image: z.string().url().max(2000) });
export const checkoutInput = z.discriminatedUnion('type', [
  z.object({ type: z.literal('purchase'), artworkId: z.string() }),
  z.object({ type: z.literal('subscription'), tier: z.enum(['pro', 'premium']) }),
  z.object({ type: z.literal('publishing'), artwork }),
]);
export const comment = z.object({ comment: z.string().trim().min(2).max(1500) });
export const tiers = { free: { limit: 3, price: 0 }, pro: { limit: 9, price: 9.99 }, premium: { limit: null, price: 19.99 } };
export function limitFor(tier) { return tiers[tier]?.limit ?? (tier === 'premium' ? Infinity : 3); }
export function publicUser(user) {
  if (!user) return null;
  const { passwordHash, tokenVersion, ...safe } = user;
  return safe;
}
export function parse(schema, data) { return schema.parse(data); }
