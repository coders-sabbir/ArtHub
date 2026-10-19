import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
export const config = {
  port: Number(process.env.PORT || 4000),
  production: process.env.NODE_ENV === 'production',
  frontend: process.env.FRONTEND_URL || 'http://localhost:3000',
  mongo: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/arthub?replicaSet=arthub',
  jwtSecret: process.env.JWT_SECRET,
};
if (!config.jwtSecret || config.jwtSecret.length < 32) throw new Error('Set JWT_SECRET to at least 32 random characters in server/.env');
