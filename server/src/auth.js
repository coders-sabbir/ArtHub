import jwt from 'jsonwebtoken';
import { database, oid } from './db.js';
import { config } from './config.js';
export const cookieOptions = { httpOnly: true, secure: config.production, sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60 * 1000 };
export function setSession(res, user) {
  const token = jwt.sign({ sub: String(user._id), version: user.tokenVersion || 0 }, config.jwtSecret, { expiresIn: '7d', issuer: 'arthub', audience: 'arthub-client' });
  res.cookie('arthub_session', token, cookieOptions);
}
export async function authenticated(req, res, next) {
  try {
    const payload = jwt.verify(req.cookies.arthub_session || '', config.jwtSecret, { issuer: 'arthub', audience: 'arthub-client' });
    const db = await database();
    const user = await db.collection('users').findOne({ _id: oid(payload.sub) });
    if (!user || (user.tokenVersion || 0) !== payload.version) return res.status(401).json({ message: 'Please sign in to continue.' });
    req.user = user; next();
  } catch (error) {
    if (['JsonWebTokenError', 'TokenExpiredError', 'NotBeforeError'].includes(error.name)) return res.status(401).json({ message: 'Please sign in to continue.' });
    return next(error);
  }
}
export function roles(...allowed) {
  return (req, res, next) => allowed.includes(req.user.role) ? next() : res.status(403).json({ message: 'You do not have access to this action.' });
}
