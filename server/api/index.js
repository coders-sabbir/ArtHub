import app from '../src/app.js';
import { indexes } from '../src/db.js';

let ready;
export default async function handler(req, res) {
  try {
    // The serverless entry does not run src/index.js. Prepare its indexes before
    // accepting registrations or payments, and allow a failed connection to retry.
    ready ||= indexes().catch(error => { ready = undefined; throw error; });
    await ready;
    return app(req, res);
  } catch (error) {
    console.error('API initialization failed:', error.name);
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ message: 'The service is temporarily unavailable. Please try again.' }));
  }
}
