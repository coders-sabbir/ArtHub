import { MongoClient, ObjectId } from 'mongodb';
import { config } from './config.js';
export const client = new MongoClient(config.mongo, { serverSelectionTimeoutMS: 8000 });
let connection;
export async function database() {
  connection ||= client.connect().catch(error => { connection = null; throw error; });
  await connection;
  return client.db();
}
export function oid(value) {
  if (typeof value !== 'string' || !ObjectId.isValid(value)) {
    const error = new Error('Invalid record ID.'); error.status = 404; throw error;
  }
  return new ObjectId(value);
}
export async function indexes() {
  const db = await database();
  await Promise.all([
    db.collection('users').createIndex({ email: 1 }, { unique: true }),
    db.collection('artworks').createIndex({ artistId: 1, createdAt: -1 }),
    db.collection('artworks').createIndex({ seedKey: 1 }, { unique: true, sparse: true }),
    db.collection('artworks').createIndex({ category: 1, price: 1 }),
    db.collection('transactions').createIndex({ externalId: 1 }, { unique: true }),
    db.collection('transactions').createIndex({ userId: 1, artworkId: 1 }),
    db.collection('comments').createIndex({ artworkId: 1, createdAt: -1 }),
    db.collection('orders').createIndex({ status: 1, expiresAt: 1 }),
  ]);
}
