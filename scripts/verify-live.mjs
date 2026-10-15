import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from '@playwright/test';

const [frontendInput, backendInput] = process.argv.slice(2);
if (!frontendInput || !backendInput) throw new Error('Usage: node scripts/verify-live.mjs <frontend-origin> <backend-origin>. Set ARTHUB_VERIFY_EMAIL and ARTHUB_VERIFY_PASSWORD for session checks.');
const frontend = new URL(frontendInput).origin;
const backend = new URL(backendInput).origin;
const email = process.env.ARTHUB_VERIFY_EMAIL;
const password = process.env.ARTHUB_VERIFY_PASSWORD;
if (!email || !password) throw new Error('Set ARTHUB_VERIFY_EMAIL and ARTHUB_VERIFY_PASSWORD; credentials are never printed or saved.');
const report = { checkedAt: new Date().toISOString(), frontend, backend, checks: [] };
function passed(name) { report.checks.push(name); console.log(`PASS ${name}`); }
async function json(origin, path, options = {}) {
  const response = await fetch(`${origin}${path}`, { ...options, signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `${path} returned HTTP ${response.status}`);
  return { response, data: await response.json() };
}
await json(backend, '/api/health', { headers: { Origin: frontend } }).then(({ response, data }) => {
  assert.equal(data.status, 'ok');
  assert.equal(response.headers.get('access-control-allow-origin'), frontend);
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  passed('backend database health and frontend CORS origin');
});
await json(frontend, '/api/health').then(({ data }) => { assert.equal(data.status, 'ok'); passed('frontend API proxy reaches the backend'); });
const { data: catalog } = await json(frontend, '/api/artworks?limit=6');
assert.ok(Array.isArray(catalog.items)); passed('public catalog API');
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
const context = await browser.newContext();
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
try {
  const publicRoutes = ['/', '/browse', '/artists', '/membership', '/about', '/contact', '/privacy', '/login', '/register'];
  if (catalog.items[0]) publicRoutes.push(`/artworks/${catalog.items[0]._id}`);
  for (const route of publicRoutes) {
    for (const reload of [false, true]) {
      const response = reload ? await page.reload() : await page.goto(`${frontend}${route}`);
      assert.equal(response.status(), 200, `${route} ${reload ? 'reload' : 'direct load'} failed`);
      await page.locator('h1').first().waitFor();
    }
  }
  passed('public routes load directly and survive reload');
  const missing = await page.goto(`${frontend}/arthub-live-check-missing-page`);
  assert.equal(missing.status(), 404);
  await page.getByRole('heading', { name: 'Page Not Found', exact: true }).waitFor();
  passed('unknown routes return the custom 404 page');
  await page.goto(`${frontend}/login`);
  await page.locator('.auth-form-wrap').getByLabel('Email address', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Account menu' }).waitFor();
  const me = await page.request.get(`${frontend}/api/auth/me`);
  assert.equal(me.status(), 200); const user = await me.json();
  assert.ok(['user', 'artist', 'admin'].includes(user.role));
  const cookies = await context.cookies(frontend);
  const session = cookies.find(cookie => cookie.name === 'arthub_session');
  assert.ok(session?.httpOnly, 'Session cookie must be HTTP-only');
  assert.equal(session.sameSite, 'Lax');
  if (frontend.startsWith('https:')) assert.ok(session.secure, 'Live session cookie must be secure');
  passed('email login and secure cookie attributes');
  const tabs = user.role === 'admin' ? ['overview', 'users', 'artworks', 'transactions', 'profile'] : user.role === 'artist' ? ['overview', 'artworks', 'sales', 'profile'] : ['overview', 'purchases', 'collection', 'membership', 'profile'];
  for (const tab of tabs) {
    const path = `/dashboard/${user.role}?tab=${tab}`;
    await page.goto(`${frontend}${path}`); await page.locator('.dashboard-heading').waitFor();
    const response = await page.reload(); assert.equal(response.status(), 200);
    await page.locator('.dashboard-heading').waitFor();
    assert.ok(new URL(page.url()).pathname === `/dashboard/${user.role}`, 'Private reload redirected to login');
    assert.equal((await page.request.get(`${frontend}/api/auth/me`)).status(), 200);
  }
  passed(`${user.role} dashboard direct loads and reload-safe sessions`);
  await page.goto(`${frontend}/dashboard/${user.role}`);
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Dashboard overflows at ${width}px`);
  }
  passed('dashboard mobile/tablet/desktop layout');
  assert.equal((await page.request.get(`${frontend}/api/dashboard`)).status(), 200);
  await page.request.post(`${frontend}/api/auth/logout`);
  assert.equal((await page.request.get(`${frontend}/api/auth/me`)).status(), 401);
  await page.goto(`${frontend}/dashboard/${user.role}`);
  await page.waitForURL(url => url.pathname === '/login');
  passed('logout clears the session and protects private routes');
  assert.deepEqual(errors, [], 'Browser runtime errors were detected');
  passed('no browser runtime errors');
  if (process.env.ARTHUB_VERIFICATION_REPORT) await fs.writeFile(process.env.ARTHUB_VERIFICATION_REPORT, `${JSON.stringify(report, null, 2)}\n`);
} finally { await context.close(); await browser.close(); }
