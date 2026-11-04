import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';
import { z, ZodError } from 'zod';
import { database, oid } from './db.js';
import { config } from './config.js';
import { authenticated, roles, setSession, cookieOptions } from './auth.js';
import { googleAuth } from './oauth.js';
import { artwork, comment, login, registration, profile, passwordChange, publicUser, categories } from './validation.js';
import { createCheckout, stripeClient, handleWebhook, fulfillCheckout, releaseOrder } from './payments.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: config.frontend, credentials: true }));
app.use(cookieParser());
app.use('/api', rateLimit({ windowMs: 60_000, limit: 240, standardHeaders: 'draft-8', legacyHeaders: false, message: { message: 'Too many requests. Please wait a moment.' } }));
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = stripeClient(); let event;
  try { event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET); }
  catch { return res.status(400).json({ message: 'Invalid webhook signature.' }); }
  await handleWebhook(event); res.json({ received: true });
});
app.use((req, res, next) => {
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.headers.origin && req.headers.origin !== config.frontend) return res.status(403).json({ message: 'Request origin is not allowed.' });
  next();
});
app.all('/api/oauth/*splat', async (req, res) => {
  const auth = await googleAuth();
  if (!auth) return res.status(503).json({ message: 'Google sign-in is not connected yet. Please use email and password.' });
  return toNodeHandler(auth)(req, res);
});
app.use(express.json({ limit: '12mb' }));
const authLimiter = rateLimit({ windowMs: 15 * 60_000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many sign-in attempts. Please try again in 15 minutes.' } });
app.get('/api/health', async (req, res) => { const db = await database(); await db.command({ ping: 1 }); res.json({ status: 'ok' }); });
app.get('/api/config', (req, res) => res.json({ demoAccounts: !config.production, google: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.BETTER_AUTH_SECRET), payments: Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET), uploads: Boolean(process.env.IMGBB_API_KEY), categories }));
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const input = registration.parse(req.body); const db = await database();
  const user = { _id: new ObjectId(), name: input.name, email: input.email, passwordHash: await bcrypt.hash(input.password, 12), role: input.role, subscriptionTier: 'free', purchaseCount: 0, reservedPurchases: 0, tokenVersion: 0, wishlist: [], bio: '', avatar: '', createdAt: new Date() };
  await db.collection('users').insertOne(user); setSession(res, user); res.status(201).json(publicUser(user));
});
app.post('/api/auth/login', authLimiter, async (req, res) => {
  const input = login.parse(req.body); const db = await database();
  const user = await db.collection('users').findOne({ email: input.email });
  if (!user?.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) return res.status(401).json({ message: 'Email or password is incorrect.' });
  setSession(res, user); res.json(publicUser(user));
});
app.post('/api/auth/google-session', authLimiter, async (req, res) => {
  const auth = await googleAuth();
  if (!auth) return res.status(503).json({ message: 'Google sign-in is not connected yet.' });
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (!session?.user?.email) return res.status(401).json({ message: 'Google sign-in could not be verified.' });
  const db = await database(); const email = session.user.email.toLowerCase();
  const role = ['user', 'artist'].includes(req.body.role) ? req.body.role : 'user';
  await db.collection('users').updateOne({ email }, { $setOnInsert: { name: session.user.name, email, role, avatar: session.user.image || '', subscriptionTier: 'free', purchaseCount: 0, reservedPurchases: 0, tokenVersion: 0, wishlist: [], bio: '', createdAt: new Date() } }, { upsert: true });
  const user = await db.collection('users').findOne({ email }); setSession(res, user); res.json(publicUser(user));
});
app.post('/api/auth/logout', (req, res) => { res.clearCookie('arthub_session', { ...cookieOptions, maxAge: undefined }); res.json({ ok: true }); });
app.get('/api/auth/me', authenticated, (req, res) => res.json(publicUser(req.user)));
app.patch('/api/profile', authenticated, async (req, res) => {
  const input = profile.parse(req.body); const db = await database();
  await db.collection('users').updateOne({ _id: req.user._id }, { $set: input });
  if (req.user.role === 'artist') await db.collection('artworks').updateMany({ artistId: req.user._id }, { $set: { artistName: input.name } });
  res.json(publicUser(await db.collection('users').findOne({ _id: req.user._id })));
});
app.patch('/api/profile/password', authenticated, async (req, res) => {
  const input = passwordChange.parse(req.body);
  if (!req.user.passwordHash || !(await bcrypt.compare(input.currentPassword, req.user.passwordHash))) return res.status(400).json({ message: 'Current password is incorrect. Google accounts use Google to manage passwords.' });
  const db = await database(); await db.collection('users').updateOne({ _id: req.user._id }, { $set: { passwordHash: await bcrypt.hash(input.password, 12) }, $inc: { tokenVersion: 1 } });
  const user = await db.collection('users').findOne({ _id: req.user._id }); setSession(res, user); res.json({ ok: true });
});
const escapeRegex = input => input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
app.get('/api/artworks', async (req, res) => {
  const query = z.object({ search: z.string().max(120).optional(), category: z.enum(categories).optional(), min: z.coerce.number().min(0).optional(), max: z.coerce.number().min(0).optional(), sort: z.enum(['newest', 'price-asc', 'price-desc']).default('newest'), page: z.coerce.number().int().min(1).max(100000).default(1), limit: z.coerce.number().int().min(1).max(24).default(12), artist: z.string().optional(), available: z.enum(['true', 'false']).optional() }).parse(req.query);
  const filter = {};
  if (query.search) filter.$or = ['title', 'artistName'].map(field => ({ [field]: { $regex: escapeRegex(query.search), $options: 'i' } }));
  if (query.category) filter.category = query.category;
  if (query.artist) filter.artistId = oid(query.artist);
  // Sold originals leave the public catalog; collectors can explicitly include them.
  if (query.available !== 'false') filter.sold = false;
  if (query.min !== undefined || query.max !== undefined) filter.price = { ...(query.min !== undefined ? { $gte: query.min } : {}), ...(query.max !== undefined ? { $lte: query.max } : {}) };
  const db = await database(); const sort = query.sort === 'newest' ? { createdAt: -1, _id: -1 } : { price: query.sort === 'price-asc' ? 1 : -1, _id: 1 };
  const [items, total] = await Promise.all([db.collection('artworks').find(filter, { projection: { reservation: 0, buyerId: 0 } }).sort(sort).skip((query.page - 1) * query.limit).limit(query.limit).toArray(), db.collection('artworks').countDocuments(filter)]);
  res.json({ items, total, page: query.page, pages: Math.ceil(total / query.limit) });
});
app.get('/api/artworks/:id', async (req, res) => {
  const db = await database(); const art = await db.collection('artworks').findOne({ _id: oid(req.params.id) }, { projection: { reservation: 0, buyerId: 0 } });
  if (!art) return res.status(404).json({ message: 'Artwork not found.' });
  const [artist, comments] = await Promise.all([db.collection('users').findOne({ _id: art.artistId }, { projection: { name: 1, avatar: 1, bio: 1 } }), db.collection('comments').find({ artworkId: art._id }).sort({ createdAt: -1 }).toArray()]);
  res.json({ ...art, artist, comments });
});
app.get('/api/artists', async (req, res) => {
  const db = await database();
  const artists = await db.collection('users').aggregate([{ $match: { role: 'artist' } }, { $lookup: { from: 'transactions', localField: '_id', foreignField: 'artistId', as: 'sales' } }, { $lookup: { from: 'artworks', localField: '_id', foreignField: 'artistId', as: 'works' } }, { $project: { name: 1, avatar: 1, bio: 1, sales: { $size: '$sales' }, artworks: { $size: '$works' }, image: { $arrayElemAt: ['$works.image', 0] } } }, { $sort: { sales: -1, artworks: -1, name: 1 } }, { $limit: 3 }]).toArray();
  res.json(artists);
});
app.get('/api/artists/:id', async (req, res) => {
  const db = await database(); const artist = await db.collection('users').findOne({ _id: oid(req.params.id), role: 'artist' }, { projection: { name: 1, avatar: 1, bio: 1 } });
  if (!artist) return res.status(404).json({ message: 'Artist not found.' }); res.json(artist);
});
app.post('/api/artworks', authenticated, roles('artist'), async (req, res) => {
  const input = artwork.parse(req.body); const db = await database();
  const art = { ...input, _id: new ObjectId(), artistId: req.user._id, artistName: req.user.name, sold: false, createdAt: new Date() };
  await db.collection('artworks').insertOne(art); res.status(201).json(art);
});
app.patch('/api/artworks/:id', authenticated, roles('artist'), async (req, res) => {
  const input = artwork.parse(req.body); const db = await database();
  const art = await db.collection('artworks').findOneAndUpdate({ _id: oid(req.params.id), artistId: req.user._id, sold: false, reservation: { $exists: false } }, { $set: { ...input, updatedAt: new Date() } }, { returnDocument: 'after' });
  if (!art) return res.status(403).json({ message: 'You can only edit your own available artworks. Reserved and sold works cannot be edited.' }); res.json(art);
});
app.delete('/api/artworks/:id', authenticated, roles('artist', 'admin'), async (req, res) => {
  const db = await database(); const filter = { _id: oid(req.params.id), reservation: { $exists: false }, ...(req.user.role !== 'admin' ? { artistId: req.user._id, sold: false } : {}) };
  const result = await db.collection('artworks').deleteOne(filter);
  if (!result.deletedCount) return res.status(403).json({ message: 'Artwork cannot be deleted. Check ownership and reservation status.' });
  await db.collection('comments').deleteMany({ artworkId: filter._id });
  await db.collection('users').updateMany({ $or: [{ wishlist: filter._id }, { cart: filter._id }] }, { $pull: { wishlist: filter._id, cart: filter._id } });
  res.json({ ok: true });
});
app.post('/api/artworks/:id/comments', authenticated, roles('user'), async (req, res) => {
  const input = comment.parse(req.body); const db = await database(); const artworkId = oid(req.params.id);
  const purchase = await db.collection('transactions').findOne({ artworkId, userId: req.user._id, type: 'purchase' });
  if (!purchase) return res.status(403).json({ message: 'Only collectors who purchased this artwork can comment.' });
  if (!await db.collection('artworks').findOne({ _id: artworkId })) return res.status(404).json({ message: 'Artwork not found.' });
  const record = { _id: new ObjectId(), artworkId, userId: req.user._id, userName: req.user.name, ...input, createdAt: new Date() };
  await db.collection('comments').insertOne(record); res.status(201).json(record);
});
app.patch('/api/comments/:id', authenticated, async (req, res) => {
  const input = comment.parse(req.body); const db = await database();
  const record = await db.collection('comments').findOneAndUpdate({ _id: oid(req.params.id), userId: req.user._id }, { $set: { ...input, updatedAt: new Date() } }, { returnDocument: 'after' });
  if (!record) return res.status(403).json({ message: 'You can only edit your own comments.' }); res.json(record);
});
app.delete('/api/comments/:id', authenticated, async (req, res) => {
  const db = await database(); const result = await db.collection('comments').deleteOne({ _id: oid(req.params.id), userId: req.user._id });
  if (!result.deletedCount) return res.status(403).json({ message: 'You can only delete your own comments.' }); res.json({ ok: true });
});
app.get('/api/wishlist', authenticated, async (req, res) => { const db = await database(); res.json(await db.collection('artworks').find({ _id: { $in: req.user.wishlist || [] } }, { projection: { reservation: 0, buyerId: 0 } }).toArray()); });
app.post('/api/wishlist/:id', authenticated, async (req, res) => {
  const db = await database(); const id = oid(req.params.id);
  if (!await db.collection('artworks').findOne({ _id: id })) return res.status(404).json({ message: 'Artwork not found.' });
  await db.collection('users').updateOne({ _id: req.user._id }, { $addToSet: { wishlist: id } }); res.json({ ok: true });
});
app.delete('/api/wishlist/:id', authenticated, async (req, res) => { const db = await database(); await db.collection('users').updateOne({ _id: req.user._id }, { $pull: { wishlist: oid(req.params.id) } }); res.json({ ok: true }); });
app.get('/api/cart', authenticated, roles('user'), async (req, res) => {
  const db = await database();
  res.json(await db.collection('artworks').find({ _id: { $in: req.user.cart || [] } }, { projection: { reservation: 0, buyerId: 0 } }).toArray());
});
app.post('/api/cart/:id', authenticated, roles('user'), async (req, res) => {
  const db = await database(); const id = oid(req.params.id);
  const art = await db.collection('artworks').findOne({ _id: id });
  if (!art) return res.status(404).json({ message: 'Artwork not found.' });
  if (art.demo || art.sold || art.artistId.equals(req.user._id)) return res.status(409).json({ message: 'Only available original artworks from other artists can be added to your cart.' });
  await db.collection('users').updateOne({ _id: req.user._id }, { $addToSet: { cart: id } });
  res.json({ ok: true });
});
app.delete('/api/cart/:id', authenticated, roles('user'), async (req, res) => {
  const db = await database();
  await db.collection('users').updateOne({ _id: req.user._id }, { $pull: { cart: oid(req.params.id) } });
  res.json({ ok: true });
});
app.get('/api/dashboard', authenticated, async (req, res) => {
  const db = await database(); const user = req.user;
  const txFilter = user.role === 'admin' ? {} : user.role === 'artist' ? { artistId: user._id, type: 'purchase' } : { userId: user._id };
  const [transactions, artworks, users] = await Promise.all([
    db.collection('transactions').find(txFilter).sort({ createdAt: -1 }).limit(500).toArray(),
    user.role === 'user' ? Promise.resolve([]) : db.collection('artworks').find(user.role === 'admin' ? {} : { artistId: user._id }, { projection: { reservation: 0, buyerId: 0 } }).sort({ createdAt: -1 }).limit(500).toArray(),
    user.role === 'admin' ? db.collection('users').find({}, { projection: { passwordHash: 0, tokenVersion: 0 } }).sort({ createdAt: -1 }).limit(500).toArray() : Promise.resolve([]),
  ]);
  let stats = null;
  if (user.role === 'admin') {
    const [totalUsers, totalArtists, sold, revenue, byCategory, sales] = await Promise.all([
      db.collection('users').countDocuments(), db.collection('users').countDocuments({ role: 'artist' }), db.collection('transactions').countDocuments({ type: 'purchase' }),
      db.collection('transactions').aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]).toArray(),
      db.collection('artworks').aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]).toArray(),
      db.collection('transactions').aggregate([{ $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, revenue: { $sum: '$amount' } } }, { $sort: { _id: 1 } }]).toArray(),
    ]); stats = { totalUsers, totalArtists, sold, revenue: revenue[0]?.total || 0, byCategory, sales };
  }
  res.json({ user: publicUser(user), transactions, artworks, users, stats });
});
app.patch('/api/admin/users/:id/role', authenticated, roles('admin'), async (req, res) => {
  const { role } = z.object({ role: z.enum(['user', 'artist', 'admin']) }).parse(req.body); const id = oid(req.params.id);
  if (id.equals(req.user._id)) return res.status(400).json({ message: 'You cannot change your own admin role.' });
  const db = await database(); const result = await db.collection('users').updateOne({ _id: id }, { $set: { role }, $inc: { tokenVersion: 1 } });
  if (!result.matchedCount) return res.status(404).json({ message: 'User not found.' }); res.json({ ok: true });
});
app.post('/api/uploads', authenticated, async (req, res) => {
  if (!process.env.IMGBB_API_KEY) return res.status(503).json({ message: 'Image uploads are not connected yet. You can use an existing image URL.' });
  const { image } = z.object({ image: z.string().min(10).max(11_000_000).regex(/^[A-Za-z0-9+/=]+$/) }).parse(req.body);
  const bytes = Buffer.from(image, 'base64');
  const valid = (bytes[0] === 0xff && bytes[1] === 0xd8) || bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) || (bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP');
  if (!valid || bytes.length > 8_000_000) return res.status(400).json({ message: 'Choose a JPG, PNG or WebP image smaller than 8 MB.' });
  const body = new URLSearchParams({ key: process.env.IMGBB_API_KEY, image });
  const response = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body, signal: AbortSignal.timeout(30000) }); const result = await response.json();
  if (!response.ok || !result.success) return res.status(502).json({ message: 'Image upload failed. Please try again.' }); res.json({ url: result.data.url });
});
app.post('/api/checkout', authenticated, roles('user'), async (req, res) => {
  const input = z.discriminatedUnion('type', [z.object({ type: z.literal('purchase'), artworkId: z.string() }), z.object({ type: z.literal('subscription'), tier: z.enum(['pro', 'premium']) })]).parse(req.body);
  res.json(await createCheckout(req.user, input));
});
app.get('/api/checkout/status', authenticated, async (req, res) => {
  const sessionId = z.string().regex(/^cs_[A-Za-z0-9_]+$/).parse(req.query.session_id); const db = await database();
  const order = await db.collection('orders').findOne({ stripeSessionId: sessionId, userId: req.user._id });
  if (!order) return res.status(404).json({ message: 'Payment session not found.' });
  res.json(await fulfillCheckout(sessionId));
});
app.post('/api/checkout/cancel', authenticated, async (req, res) => {
  const sessionId = z.string().regex(/^cs_[A-Za-z0-9_]+$/).parse(req.body.sessionId); const db = await database();
  const order = await db.collection('orders').findOne({ stripeSessionId: sessionId, userId: req.user._id, status: 'pending' });
  if (order) {
    const stripe = stripeClient(); const checkout = await stripe.checkout.sessions.retrieve(sessionId);
    if (checkout.status === 'complete') return res.status(409).json({ message: 'This checkout has already completed.' });
    if (checkout.status === 'open') await stripe.checkout.sessions.expire(sessionId);
    await releaseOrder(order._id);
  }
  res.json({ ok: true });
});
app.post('/api/billing/portal', authenticated, roles('user'), async (req, res) => {
  if (!req.user.stripeCustomerId) return res.status(400).json({ message: 'You do not have an active subscription.' });
  const session = await stripeClient().billingPortal.sessions.create({ customer: req.user.stripeCustomerId, return_url: `${config.frontend}/dashboard/user?tab=membership` }); res.json({ url: session.url });
});
app.use('/api', (req, res) => res.status(404).json({ message: 'Endpoint not found.' }));
app.use((error, req, res, next) => {
  if (error instanceof ZodError) return res.status(400).json({ message: error.issues[0]?.message || 'Check the form fields.' });
  if (error.code === 11000) return res.status(409).json({ message: 'This email or transaction already exists.' });
  if (error.type === 'entity.too.large') return res.status(413).json({ message: 'The uploaded image is too large.' });
  if (error.status && error.status < 500) return res.status(error.status).json({ message: error.message });
  if (error.status === 503) return res.status(503).json({ message: error.message });
  console.error('API request failed:', error.message);
  res.status(503).json({ message: 'The service is temporarily unavailable. Please try again.' });
});
export default app;
