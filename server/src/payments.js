import Stripe from 'stripe';
import { ObjectId } from 'mongodb';
import { client, database, oid } from './db.js';
import { config } from './config.js';
import { limitFor, tiers } from './validation.js';
export function stripeClient() {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    const error = new Error('Checkout is unavailable while payment services are being connected. No payment has been taken.'); error.status = 503; throw error;
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}
function failure(message, status = 409) { const error = new Error(message); error.status = status; throw error; }
export async function releaseOrder(id) {
  const db = await database(); const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await db.collection('orders').findOneAndUpdate({ _id: id, status: 'pending' }, { $set: { status: 'expired' } }, { session, returnDocument: 'before' });
      if (!order) return;
      if (order.type === 'purchase') {
        await db.collection('users').updateOne({ _id: order.userId, reservedPurchases: { $gt: 0 } }, { $inc: { reservedPurchases: -1 } }, { session });
        await db.collection('artworks').updateOne({ _id: order.artworkId, reservation: id }, { $unset: { reservation: '', reservedUntil: '' } }, { session });
      }
    });
  } finally { await session.endSession(); }
}
export async function expireOrders(stripe = stripeClient()) {
  const db = await database();
  const stale = await db.collection('orders').find({ status: 'pending', expiresAt: { $lt: new Date() } }).limit(100).toArray();
  for (const order of stale) {
    if (!order.stripeSessionId) { await releaseOrder(order._id); continue; }
    const checkout = await stripe.checkout.sessions.retrieve(order.stripeSessionId);
    if (checkout.payment_status === 'paid') await fulfillCheckout(checkout.id, stripe);
    else if (checkout.status === 'expired') await releaseOrder(order._id);
  }
}
export async function createCheckout(user, input, stripe = stripeClient()) {
  const db = await database();
  await expireOrders(stripe);
  const id = new ObjectId(); const expiresAt = new Date(Date.now() + 31 * 60 * 1000);
  const session = client.startSession(); let order;
  try {
    await session.withTransaction(async () => {
      const current = await db.collection('users').findOne({ _id: user._id }, { session });
      if (current.role !== 'user') failure('Only buyer accounts can make purchases or subscribe.', 403);
      if (input.type === 'purchase') {
        const art = await db.collection('artworks').findOne({ _id: oid(input.artworkId) }, { session });
        if (!art) failure('Artwork not found.', 404);
        if (art.demo) failure('This sample museum reproduction is not for sale. Explore original artist listings to make a purchase.', 400);
        if (art.artistId.equals(user._id)) failure('You cannot buy your own artwork.', 403);
        if (art.sold || art.reservation) failure('This artwork is sold or currently reserved.');
        if ((current.purchaseCount || 0) + (current.reservedPurchases || 0) >= limitFor(current.subscriptionTier)) failure('You have reached your purchase limit. Upgrade your collection plan to continue.');
        order = { _id: id, userId: user._id, artistId: art.artistId, artworkId: art._id, title: art.title, artistName: art.artistName, image: art.image, amount: art.price, type: 'purchase', status: 'pending', expiresAt, createdAt: new Date() };
        await db.collection('users').updateOne({ _id: user._id }, { $inc: { reservedPurchases: 1 } }, { session });
        await db.collection('artworks').updateOne({ _id: art._id, sold: false, reservation: { $exists: false } }, { $set: { reservation: id, reservedUntil: expiresAt } }, { session });
      } else {
        if (!['pro', 'premium'].includes(input.tier)) failure('Choose a valid subscription.', 400);
        if (current.stripeSubscriptionId) failure('Manage your existing subscription from your dashboard.');
        const pending = await db.collection('orders').findOne({ userId: user._id, type: 'subscription', status: 'pending' }, { session });
        if (pending) failure('You already have a subscription checkout in progress. Try again after it expires.');
        await db.collection('users').updateOne({ _id: user._id }, { $set: { checkoutUpdatedAt: new Date() } }, { session });
        order = { _id: id, userId: user._id, type: 'subscription', tier: input.tier, title: `ArtHub ${input.tier} membership`, amount: tiers[input.tier].price, status: 'pending', expiresAt, createdAt: new Date() };
      }
      await db.collection('orders').insertOne(order, { session });
    });
  } finally { await session.endSession(); }
  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: order.type === 'purchase' ? 'payment' : 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [{ price_data: { currency: 'usd', unit_amount: Math.round(order.amount * 100), product_data: { name: order.title }, ...(order.type === 'subscription' ? { recurring: { interval: 'month' } } : {}) }, quantity: 1 }],
      metadata: { orderId: String(id), userId: String(user._id) },
      ...(order.type === 'subscription' ? { subscription_data: { metadata: { userId: String(user._id), tier: order.tier } } } : {}),
      expires_at: Math.floor(expiresAt.getTime() / 1000),
      success_url: `${config.frontend}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.frontend}/checkout/cancel?session_id={CHECKOUT_SESSION_ID}`,
    }, { idempotencyKey: String(id) });
    await db.collection('orders').updateOne({ _id: id }, { $set: { stripeSessionId: checkout.id } });
    return { url: checkout.url };
  } catch (error) { await releaseOrder(id); throw error; }
}
export async function fulfillCheckout(checkoutId, stripe = stripeClient()) {
  const checkout = await stripe.checkout.sessions.retrieve(checkoutId);
  if (checkout.payment_status !== 'paid') return { status: 'pending' };
  if (!checkout.metadata?.orderId) return { status: 'ignored' };
  const db = await database(); const session = client.startSession();
  try {
    await session.withTransaction(async () => {
      const order = await db.collection('orders').findOne({ _id: oid(checkout.metadata.orderId) }, { session });
      if (!order || order.status === 'completed') return;
      if (order.status !== 'pending') failure('This order requires payment support review.');
      if (checkout.amount_total !== Math.round(order.amount * 100) || checkout.currency !== 'usd' || String(order.userId) !== checkout.metadata.userId) failure('Payment details did not match the order.');
      const buyer = await db.collection('users').findOne({ _id: order.userId }, { session });
      await db.collection('transactions').insertOne({ externalId: checkout.id, orderId: order._id, userId: order.userId, userName: buyer.name, userEmail: buyer.email, artistId: order.artistId || null, artworkId: order.artworkId || null, title: order.title, image: order.image || null, artistName: order.artistName || null, amount: order.amount, type: order.type, createdAt: new Date() }, { session });
      if (order.type === 'purchase') {
        const result = await db.collection('artworks').updateOne({ _id: order.artworkId, reservation: order._id, sold: false }, { $set: { sold: true, soldAt: new Date(), buyerId: order.userId }, $unset: { reservation: '', reservedUntil: '' } }, { session });
        if (!result.modifiedCount) failure('Artwork reservation could not be fulfilled. Contact support.');
        await db.collection('users').updateOne({ _id: order.userId }, { $inc: { purchaseCount: 1, reservedPurchases: -1 } }, { session });
      } else await db.collection('users').updateOne({ _id: order.userId }, { $set: { subscriptionTier: order.tier, stripeSubscriptionId: checkout.subscription, stripeCustomerId: checkout.customer } }, { session });
      await db.collection('orders').updateOne({ _id: order._id }, { $set: { status: 'completed', completedAt: new Date(), stripeSessionId: checkout.id } }, { session });
    });
    return { status: 'completed' };
  } finally { await session.endSession(); }
}
export async function handleWebhook(event) {
  const db = await database();
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) return fulfillCheckout(event.data.object.id);
  if (event.type === 'checkout.session.expired' && event.data.object.metadata?.orderId) return releaseOrder(oid(event.data.object.metadata.orderId));
  if (['customer.subscription.updated', 'customer.subscription.deleted'].includes(event.type)) {
    const sub = event.data.object;
    if (sub.metadata?.userId) {
      const active = ['active', 'trialing'].includes(sub.status);
      const update = active ? { $set: { subscriptionTier: sub.metadata.tier } } : { $set: { subscriptionTier: 'free' }, ...(sub.status === 'canceled' ? { $unset: { stripeSubscriptionId: '' } } : {}) };
      await db.collection('users').updateOne({ _id: oid(sub.metadata.userId), stripeSubscriptionId: sub.id }, update);
    }
  }
  if (event.type === 'invoice.paid') {
    const invoice = event.data.object;
    if (invoice.billing_reason !== 'subscription_cycle') return;
    const subscription = invoice.parent?.subscription_details?.subscription || invoice.subscription;
    const buyer = await db.collection('users').findOne({ stripeSubscriptionId: subscription });
    if (buyer) await db.collection('transactions').updateOne({ externalId: invoice.id }, { $setOnInsert: { userId: buyer._id, userName: buyer.name, userEmail: buyer.email, type: 'subscription', title: `ArtHub ${buyer.subscriptionTier} renewal`, amount: invoice.amount_paid / 100, createdAt: new Date() } }, { upsert: true });
  }
}
