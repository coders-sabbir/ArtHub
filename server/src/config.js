import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)), quiet: true });
export const config = {
  port: Number(process.env.PORT || 4000),
  production: process.env.NODE_ENV === 'production',
  frontend: process.env.FRONTEND_URL || 'http://localhost:3000',
  mongo: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/arthub?replicaSet=arthub',
  jwtSecret: process.env.JWT_SECRET,
  publishingFee: Number(process.env.PUBLISHING_FEE_USD || 0),
};
if (!config.jwtSecret || config.jwtSecret.length < 32) throw new Error('Set JWT_SECRET to at least 32 random characters in server/.env');
if (!Number.isFinite(config.publishingFee) || config.publishingFee < 0 || (config.publishingFee > 0 && config.publishingFee < 0.5) || Math.abs(config.publishingFee * 100 - Math.round(config.publishingFee * 100)) > 0.00001) {
  throw new Error('PUBLISHING_FEE_USD must be 0 (free) or at least 0.50 USD, with at most two decimal places.');
}
