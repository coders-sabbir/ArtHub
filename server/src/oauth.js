import { betterAuth } from 'better-auth';
import { mongodbAdapter } from '@better-auth/mongo-adapter';
import { database } from './db.js';
import { config } from './config.js';
let instance;
export async function googleAuth() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.BETTER_AUTH_SECRET) return null;
  if (!instance) instance = betterAuth({
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: config.frontend,
    basePath: '/api/oauth',
    database: mongodbAdapter(await database()),
    trustedOrigins: [config.frontend],
    socialProviders: { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET } },
    session: { expiresIn: 7 * 24 * 60 * 60 },
  });
  return instance;
}
