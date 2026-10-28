import fs from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { database, indexes, client } from './db.js';
import { config } from './config.js';
if (config.production && (!process.env.SEED_ADMIN_PASSWORD || !process.env.SEED_DEMO_PASSWORD)) throw new Error('Set explicit seed passwords before seeding production.');
const db = await database(); await indexes();
const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'Admin@123';
const demoPassword = process.env.SEED_DEMO_PASSWORD || 'ArtHub@123';
const profiles = [
  { email: 'admin@arthub.com', name: 'ArtHub Admin', role: 'admin', bio: 'Marketplace administrator.' },
  { email: 'buyer@arthub.com', name: 'Alex Morgan', role: 'user', bio: 'A growing collection of everyday inspiration.' },
  { email: 'artist@arthub.com', name: 'Mira Sullivan', role: 'artist', bio: 'Demo artist profile. Curating painterly landscapes, natural light, and quiet moments.' },
  { email: 'james@arthub.com', name: 'James Okafor', role: 'artist', bio: 'Demo artist profile. Exploring shape, texture, and the beauty of everyday forms.' },
  { email: 'hana@arthub.com', name: 'Hana Kim', role: 'artist', bio: 'Demo artist profile. Inspired by Japanese printmaking and atmospheric landscapes.' },
];
for (const profile of profiles) await db.collection('users').updateOne({ email: profile.email }, { $setOnInsert: { ...profile, passwordHash: await bcrypt.hash(profile.role === 'admin' ? adminPassword : demoPassword, 12), subscriptionTier: 'free', purchaseCount: 0, reservedPurchases: 0, tokenVersion: 0, wishlist: [], avatar: '', createdAt: new Date(), demo: true } }, { upsert: true });
const users = await db.collection('users').find({ email: { $in: profiles.map(p => p.email) } }).toArray();
const artistUsers = [users.find(u => u.email === 'artist@arthub.com'), users.find(u => u.email === 'james@arthub.com'), users.find(u => u.email === 'hana@arthub.com')];
const source = JSON.parse(await fs.readFile(new URL('../data/artwork-sources.json', import.meta.url), 'utf8')).artworks;
const prices = [320, 185, 240, 210, 295, 265, 120, 145, 160, 420, 380, 310];
for (let i = 0; i < source.length; i++) {
  const image = source[i]; const artist = artistUsers[i >= 6 && i <= 8 ? 2 : i === 9 || i === 10 ? 1 : 0];
  const title = i === 6 ? 'The Great Wave' : image.title;
  await db.collection('artworks').updateOne({ seedKey: image.id }, { $setOnInsert: { _id: new ObjectId(), seedKey: image.id, demo: true, title, artistId: artist._id, artistName: artist.name, originalArtist: image.artist, price: prices[i], category: i >= 6 && i <= 8 ? 'Printmaking' : i === 9 ? 'Sculpture' : i === 10 ? 'Digital' : 'Painting', image: image.localImage, sourceUrl: image.source_url, sourceMuseum: image.museum, medium: image.medium, description: `A public-domain reproduction of ${title} by ${image.artist} (${image.date}). ${image.medium}. This sample listing lets you explore ArtHub; the museum original is not for sale. Image courtesy of ${image.museum} under CC0. Upload your own original artwork from an artist account to create a real listing.`, sold: false, createdAt: new Date(Date.now() - i * 86400000) } }, { upsert: true });
}
const buyer = users.find(u => u.email === 'buyer@arthub.com');
for (let i = 0; i < 2; i++) {
  const image = source[i === 0 ? 11 : 6]; const artist = artistUsers[i === 0 ? 0 : 2]; const externalId = `demo-purchase-${i + 1}`;
  const art = await db.collection('artworks').findOneAndUpdate({ seedKey: `sold-${image.id}` }, { $setOnInsert: { title: `${i === 0 ? 'Water Lilies' : 'The Great Wave'} · collector edition`, artistId: artist._id, artistName: artist.name, originalArtist: image.artist, price: i === 0 ? 210 : 95, category: i === 0 ? 'Painting' : 'Printmaking', image: image.localImage, sourceUrl: image.source_url, sourceMuseum: image.museum, description: 'Sample purchased artwork for exploring collection history and comments. A public-domain museum reproduction, with no real payment or sale.', sold: true, demo: true, buyerId: buyer._id, seedKey: `sold-${image.id}`, createdAt: new Date(Date.now() - 20 * 86400000), soldAt: new Date(Date.now() - (i + 1) * 86400000) } }, { upsert: true, returnDocument: 'after' });
  await db.collection('transactions').updateOne({ externalId }, { $setOnInsert: { externalId, userId: buyer._id, userName: buyer.name, userEmail: buyer.email, artistId: artist._id, artworkId: art._id, title: art.title, image: art.image, artistName: artist.name, amount: art.price, type: 'purchase', demo: true, createdAt: art.soldAt } }, { upsert: true });
}
await db.collection('users').updateOne({ _id: buyer._id }, { $set: { purchaseCount: await db.collection('transactions').countDocuments({ userId: buyer._id, type: 'purchase' }) } });
console.log('Seed complete: 5 demo accounts, 14 sample listings, 2 clearly marked sample purchases. Existing accounts and listings were preserved.');
await client.close();
