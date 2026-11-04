import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import app from '../src/app.js';
import { database, client } from '../src/db.js';
import { createCheckout, fulfillCheckout, releaseOrder } from '../src/payments.js';
import { registration, artwork, limitFor } from '../src/validation.js';

const tag = `qa-${Date.now()}`;
let db, server, base;
const ids = [];
const accounts = {};
const sessions = new Map();
let failStripe = false;
const stripe = { checkout: { sessions: {
  async create(input) { if (failStripe) throw new Error('Fixture checkout failure'); const id = `cs_test_${input.metadata.orderId}`; const record = { id, metadata: input.metadata, currency: 'usd', amount_total: input.line_items[0].price_data.unit_amount, payment_status: 'unpaid', status: 'open', customer: 'cus_fixture', subscription: 'sub_fixture', url: `https://checkout.stripe.com/${id}` }; sessions.set(id, record); return record; },
  async retrieve(id) { const record = sessions.get(id); if (!record) throw new Error('Missing fixture session'); return record; },
} } };
async function request(path, { method = 'GET', cookie, data, origin } = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}), ...(origin ? { Origin: origin } : {}) }, ...(data !== undefined ? { body: JSON.stringify(data) } : {}) });
  return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
async function account(role, suffix) {
  const user = { _id: new ObjectId(), email: `${tag}-${suffix}@example.com`, name: `${tag} ${suffix}`, role, passwordHash: await bcrypt.hash('Testing@123', 4), subscriptionTier: 'free', purchaseCount: 0, reservedPurchases: 0, tokenVersion: 0, wishlist: [], bio: '', avatar: '', createdAt: new Date() };
  ids.push(user._id); await db.collection('users').insertOne(user);
  const result = await request('/api/auth/login', { method: 'POST', data: { email: user.email, password: 'Testing@123' } }); assert.equal(result.status, 200); return { user, cookie: result.cookie };
}
async function art(artist, extra = {}) {
  const doc = { _id: new ObjectId(), title: `${tag} artwork`, description: 'An original artwork created for integration verification.', artistId: artist._id, artistName: artist.name, image: 'https://example.com/fixture.jpg', category: 'Painting', price: 40, sold: false, createdAt: new Date(), ...extra };
  await db.collection('artworks').insertOne(doc); return doc;
}
before(async () => {
  db = await database(); server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); }); base = `http://127.0.0.1:${server.address().port}`;
  for (const [name, role] of [['buyer','user'], ['artist','artist'], ['outsider','artist'], ['admin','admin'], ['payment','user']]) accounts[name] = await account(role, name);
});
after(async () => {
  await db.collection('comments').deleteMany({ userId: { $in: ids } });
  await db.collection('transactions').deleteMany({ userId: { $in: ids } });
  await db.collection('orders').deleteMany({ userId: { $in: ids } });
  await db.collection('artworks').deleteMany({ artistId: { $in: ids } });
  await db.collection('users').deleteMany({ _id: { $in: ids } });
  await new Promise(resolve => server.close(resolve)); await client.close();
});
test('registration rejects admin role, weak passwords and mismatched confirmation', () => {
  const input = { name: 'Test Member', email: 'test@example.com', password: 'Testing@123', confirmPassword: 'Testing@123', role: 'user' };
  assert.equal(registration.safeParse({ ...input, role: 'admin' }).success, false);
  assert.equal(registration.safeParse({ ...input, password: 'testing123' }).success, false);
  assert.equal(registration.safeParse({ ...input, confirmPassword: 'Different@123' }).success, false);
  assert.equal(artwork.safeParse({ title: 'My art', description: 'A long enough description.', price: 1.001, category: 'Painting', image: 'https://example.com/image.jpg' }).success, false);
  assert.equal(limitFor('premium'), Infinity);
});
test('public catalog filters, sorts, paginates and rejects invalid record IDs', async () => {
  await art(accounts.artist.user, { price: 10 }); await art(accounts.artist.user, { price: 50 });
  const result = await request(`/api/artworks?search=${tag}&category=Painting&min=5&max=60&sort=price-asc&limit=1`);
  assert.equal(result.status, 200); assert.equal(result.data.total, 2); assert.equal(result.data.pages, 2); assert.equal(result.data.items[0].price, 10);
  assert.equal((await request('/api/artworks/not-an-id')).status, 404);
  assert.equal((await request('/api/artworks?sort=invalid')).status, 400);
});
test('email registration issues a seven-day session and duplicate emails are rejected', async () => {
  const input = { name: `${tag} registered`, email: `${tag}-registered@EXAMPLE.COM`, password: 'Testing@123', confirmPassword: 'Testing@123', role: 'user' };
  const registered = await request('/api/auth/register', { method: 'POST', data: input }); assert.equal(registered.status, 201); ids.push(new ObjectId(registered.data._id));
  assert.ok(registered.cookie.startsWith('arthub_session=')); assert.equal(registered.data.passwordHash, undefined);
  const me = await request('/api/auth/me', { cookie: registered.cookie }); assert.equal(me.status, 200); assert.equal(me.data.email, input.email.toLowerCase());
  assert.equal((await request('/api/auth/register', { method: 'POST', data: input })).status, 409);
});
test('server enforces roles, foreign origins and artist ownership', async () => {
  assert.equal((await request('/api/dashboard')).status, 401);
  assert.equal((await request('/api/artworks', { method: 'POST', cookie: accounts.buyer.cookie, data: { role: 'artist' } })).status, 403);
  assert.equal((await request('/api/auth/logout', { method: 'POST', origin: 'https://evil.example', cookie: accounts.buyer.cookie, data: {} })).status, 403);
  const created = await request('/api/artworks', { method: 'POST', cookie: accounts.artist.cookie, data: { title: `${tag} owned`, description: 'An original artwork with a meaningful description.', price: 70, category: 'Painting', image: 'https://example.com/image.jpg' } }); assert.equal(created.status, 201);
  assert.equal((await request(`/api/artworks/${created.data._id}`, { method: 'DELETE', cookie: accounts.outsider.cookie })).status, 403);
  const changed = await request(`/api/artworks/${created.data._id}`, { method: 'PATCH', cookie: accounts.artist.cookie, data: { ...created.data, price: 75 } }); assert.equal(changed.status, 200); assert.equal(changed.data.price, 75);
  assert.equal((await request(`/api/artworks/${created.data._id}`, { method: 'DELETE', cookie: accounts.artist.cookie })).status, 200);
});
test('comments require a purchase, and edit/delete require comment ownership', async () => {
  const piece = await art(accounts.artist.user); const path = `/api/artworks/${piece._id}/comments`;
  assert.equal((await request(path, { method: 'POST', cookie: accounts.buyer.cookie, data: { comment: 'A wonderful artwork.' } })).status, 403);
  await db.collection('transactions').insertOne({ externalId: `${tag}-comment-purchase`, userId: accounts.buyer.user._id, artworkId: piece._id, type: 'purchase', amount: 40, createdAt: new Date() });
  const posted = await request(path, { method: 'POST', cookie: accounts.buyer.cookie, data: { comment: 'A wonderful artwork.' } }); assert.equal(posted.status, 201);
  const commentPath = `/api/comments/${posted.data._id}`;
  assert.equal((await request(commentPath, { method: 'PATCH', cookie: accounts.outsider.cookie, data: { comment: 'Attempt to edit another member.' } })).status, 403);
  assert.equal((await request(commentPath, { method: 'PATCH', cookie: accounts.buyer.cookie, data: { comment: 'Beautiful texture and color.' } })).status, 200);
  assert.equal((await request(commentPath, { method: 'DELETE', cookie: accounts.buyer.cookie })).status, 200);
});
test('wishlist persists on the server and does not duplicate saved artworks', async () => {
  const piece = await art(accounts.artist.user, { buyerId: accounts.outsider.user._id, reservation: new ObjectId() }); const path = `/api/wishlist/${piece._id}`;
  await request(path, { method: 'POST', cookie: accounts.buyer.cookie }); await request(path, { method: 'POST', cookie: accounts.buyer.cookie });
  const list = await request('/api/wishlist', { cookie: accounts.buyer.cookie }); assert.equal(list.data.filter(a => a._id === String(piece._id)).length, 1); assert.equal(list.data[0].buyerId, undefined); assert.equal(list.data[0].reservation, undefined);
  await request(path, { method: 'DELETE', cookie: accounts.buyer.cookie }); assert.equal((await request('/api/wishlist', { cookie: accounts.buyer.cookie })).data.length, 0);
});
test('checkout is unavailable without payment credentials, and invalid webhook signatures are rejected', async () => {
  const previousKey = process.env.STRIPE_SECRET_KEY; const previousHook = process.env.STRIPE_WEBHOOK_SECRET;
  try {
    delete process.env.STRIPE_SECRET_KEY; delete process.env.STRIPE_WEBHOOK_SECRET;
    assert.equal((await request('/api/checkout', { method: 'POST', cookie: accounts.buyer.cookie, data: { type: 'subscription', tier: 'pro' } })).status, 503);
    process.env.STRIPE_SECRET_KEY = 'sk_test_fixture'; process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fixture';
    assert.equal((await request('/api/payments/webhook', { method: 'POST', data: { type: 'checkout.session.completed' } })).status, 400);
  } finally { if (previousKey) process.env.STRIPE_SECRET_KEY = previousKey; else delete process.env.STRIPE_SECRET_KEY; if (previousHook) process.env.STRIPE_WEBHOOK_SECRET = previousHook; else delete process.env.STRIPE_WEBHOOK_SECRET; }
});
test('simultaneous checkout requests cannot reserve the same artwork twice', async () => {
  const piece = await art(accounts.artist.user);
  const results = await Promise.allSettled([createCheckout(accounts.payment.user, { type: 'purchase', artworkId: String(piece._id) }, stripe), createCheckout(accounts.buyer.user, { type: 'purchase', artworkId: String(piece._id) }, stripe)]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  const order = await db.collection('orders').findOne({ artworkId: piece._id, status: 'pending' }); await releaseOrder(order._id);
});
test('purchase limits include concurrent reservations and failed Stripe sessions roll back', async () => {
  const pieces = await Promise.all(Array.from({ length: 4 }, () => art(accounts.artist.user)));
  const results = await Promise.allSettled(pieces.map(piece => createCheckout(accounts.payment.user, { type: 'purchase', artworkId: String(piece._id) }, stripe)));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 3);
  const orders = await db.collection('orders').find({ userId: accounts.payment.user._id, status: 'pending' }).toArray(); for (const order of orders) await releaseOrder(order._id);
  failStripe = true;
  await assert.rejects(createCheckout(accounts.payment.user, { type: 'purchase', artworkId: String(pieces[0]._id) }, stripe)); failStripe = false;
  const current = await db.collection('users').findOne({ _id: accounts.payment.user._id }); assert.equal(current.reservedPurchases, 0);
  assert.equal((await db.collection('artworks').findOne({ _id: pieces[0]._id })).reservation, undefined);
});
test('verified payment fulfillment is idempotent and demo listings cannot be purchased', async () => {
  const piece = await art(accounts.artist.user); await createCheckout(accounts.payment.user, { type: 'purchase', artworkId: String(piece._id) }, stripe);
  const order = await db.collection('orders').findOne({ artworkId: piece._id }); const record = sessions.get(order.stripeSessionId); record.payment_status = 'paid'; record.status = 'complete';
  await Promise.all([fulfillCheckout(record.id, stripe), fulfillCheckout(record.id, stripe)]);
  assert.equal(await db.collection('transactions').countDocuments({ externalId: record.id }), 1);
  assert.equal((await db.collection('artworks').findOne({ _id: piece._id })).sold, true);
  const current = await db.collection('users').findOne({ _id: accounts.payment.user._id }); assert.equal(current.purchaseCount, 1); assert.equal(current.reservedPurchases, 0);
  const demo = await art(accounts.artist.user, { demo: true }); await assert.rejects(createCheckout(accounts.payment.user, { type: 'purchase', artworkId: String(demo._id) }, stripe), /not for sale/);
});
test('password changes revoke previous sessions and admin roles are assigned server-side', async () => {
  const changed = await request('/api/profile/password', { method: 'PATCH', cookie: accounts.buyer.cookie, data: { currentPassword: 'Testing@123', password: 'Changed@123', confirmPassword: 'Changed@123' } }); assert.equal(changed.status, 200);
  assert.equal((await request('/api/auth/me', { cookie: accounts.buyer.cookie })).status, 401); assert.equal((await request('/api/auth/me', { cookie: changed.cookie })).status, 200);
  assert.equal((await request(`/api/admin/users/${accounts.outsider.user._id}/role`, { method: 'PATCH', cookie: accounts.artist.cookie, data: { role: 'admin' } })).status, 403);
  const role = await request(`/api/admin/users/${accounts.outsider.user._id}/role`, { method: 'PATCH', cookie: accounts.admin.cookie, data: { role: 'user' } }); assert.equal(role.status, 200);
  assert.equal((await request('/api/auth/me', { cookie: accounts.outsider.cookie })).status, 401);
});
