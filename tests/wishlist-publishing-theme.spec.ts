import { test, expect, Page } from '@playwright/test';

const artwork = { _id: 'aaaaaaaaaaaaaaaaaaaaaaaa', title: 'Saved original', description: 'An original artwork saved by a collector.', artistId: 'bbbbbbbbbbbbbbbbbbbbbbbb', artistName: 'Test Artist', image: '/artworks/aic-8987.webp', category: 'Painting', price: 75, sold: false, published: true, createdAt: '2026-11-01T00:00:00Z', comments: [] };
const account = { _id: 'cccccccccccccccccccccccc', name: 'Test Collector', email: 'collector@example.com', role: 'user', wishlist: [artwork._id], cart: [], subscriptionTier: 'free', purchaseCount: 0, avatar: '', bio: '' };

test('dark mode persists through navigation and reload, and can switch back to light', async ({ page }) => {
  await page.route('**/api/auth/me', route => route.fulfill({ status: 401, json: { message: 'Please sign in.' } }));
  await page.goto('/about');
  const toggle = page.getByRole('button', { name: 'Toggle color theme' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await toggle.click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('theme'))).toBe('dark');
  await page.goto('/contact'); await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await toggle.click(); await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('sold saved artwork shows badges on its card and details and disables purchase', async ({ page }) => {
  const sold = { ...artwork, sold: true, published: false };
  await page.route('**/api/auth/me', route => route.fulfill({ json: account }));
  await page.route('**/api/wishlist', route => route.fulfill({ json: [sold] }));
  await page.route(`**/api/artworks/${artwork._id}`, route => route.fulfill({ json: sold }));
  await page.route('**/api/dashboard', route => route.fulfill({ json: { transactions: [] } }));
  await page.goto('/wishlist');
  await expect(page.locator('.art-badge')).toHaveText('Sold');
  await expect(page.locator('.art-card').getByRole('button', { name: 'Sold', exact: true })).toBeDisabled();
  await page.locator('.art-title').click();
  await expect(page.locator('.pill-sold')).toHaveText('Sold');
  await expect(page.getByRole('button', { name: 'This piece has found a home', exact: true })).toBeDisabled();
});

async function artistSession(page: Page, fee: number) {
  await page.route('**/api/auth/me', route => route.fulfill({ json: { ...account, role: 'artist' } }));
  await page.route('**/api/config', route => route.fulfill({ json: { publishingFee: fee, uploads: false } }));
}

test('publishing fee is disclosed before submission and payment errors preserve the artwork form', async ({ page }) => {
  await artistSession(page, 5);
  await page.route('**/api/artworks', route => route.fulfill({ status: 503, json: { message: 'Payment service is unavailable' } }));
  await page.goto('/dashboard/artist/artworks/new');
  await expect(page.getByText('Publishing fee: $5 USD.', { exact: false })).toBeVisible();
  await page.getByLabel('Or paste an image URL').fill('https://example.com/original.jpg');
  await page.getByLabel('Artwork title', { exact: true }).fill('My original artwork');
  await page.getByLabel('The story behind it').fill('An original artwork with a description for its future collector.');
  await page.getByLabel('Price (USD)').fill('75');
  await page.getByLabel('Category', { exact: true }).selectOption('Painting');
  await page.getByRole('button', { name: 'Pay $5 & publish', exact: true }).click();
  await expect(page.locator('.artwork-form').getByRole('alert')).toContainText('Payment service is unavailable');
  await expect(page.getByLabel('Artwork title', { exact: true })).toHaveValue('My original artwork');
  await expect(page.getByRole('button', { name: 'Pay $5 & publish', exact: true })).toBeEnabled();
});

test('free publishing and artist checkout return routes remain available', async ({ page }) => {
  await artistSession(page, 0);
  await page.goto('/dashboard/artist/artworks/new');
  await expect(page.getByText('Publishing is free.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Publish artwork', exact: true })).toBeEnabled();
  await page.route('**/api/checkout/status?*', route => route.fulfill({ json: { status: 'completed' } }));
  await page.goto('/checkout/success?session_id=cs_test_publishing');
  await expect(page.getByRole('heading', { name: 'Your artwork is in the gallery.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'My dashboard', exact: true })).toHaveAttribute('href', '/dashboard/artist');
  await page.route('**/api/checkout/cancel', route => route.fulfill({ json: { ok: true } }));
  await page.goto('/checkout/cancel?session_id=cs_test_publishing');
  await expect(page.getByRole('heading', { name: 'A little more time to decide.' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'My dashboard', exact: true })).toHaveAttribute('href', '/dashboard/artist');
});
