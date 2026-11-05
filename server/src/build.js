// Run the existing idempotent seed on Vercel only when explicitly requested.
// Database credentials remain in Vercel; no bootstrap endpoint is exposed.
if (process.env.SEED_DEMO_DATA === 'true') {
  if (!process.env.MONGODB_URI || /localhost|127\.0\.0\.1|\[::1\]/i.test(process.env.MONGODB_URI)) {
    throw new Error('An explicit remote MongoDB connection is required for deployment seeding.');
  }
  if (!process.env.SEED_ADMIN_PASSWORD || !process.env.SEED_DEMO_PASSWORD) {
    throw new Error('Set explicit seed account passwords before enabling deployment seeding.');
  }
  await import('./seed.js');
} else {
  console.log('API build ready. Demo database seeding was not requested.');
}
