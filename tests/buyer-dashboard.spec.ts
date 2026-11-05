import { test, expect, type Page } from '@playwright/test';

test.use({ baseURL: process.env.ARTHUB_UI_TEST_URL || 'http://localhost:3000' });

const user = { _id: '111111111111111111111111', name: 'Test Collector', email: 'collector@example.com', role: 'user', subscriptionTier: 'pro', purchaseCount: 6, avatar: '', bio: '', wishlist: [], cart: [] };
const purchases = Array.from({ length: 6 }, (_, index) => ({
  _id: `purchase-${index}`, artworkId: String(index + 1).padStart(24, '0'), title: `Collected artwork ${index + 1}`,
  image: '/artworks/aic-8987.webp', artistName: 'Test Artist', amount: 125 + index,
  type: 'purchase', createdAt: '2026-11-01T12:00:00.000Z',
}));
const subscription = { _id: 'subscription', title: 'ArtHub pro membership', amount: 9.99, type: 'subscription', createdAt: '2026-11-02T12:00:00.000Z' };

async function dashboardSession(page: Page, empty = false) {
  const account = { ...user, purchaseCount: empty ? 0 : user.purchaseCount };
  await page.route('**/api/auth/me', route => route.fulfill({ json: account }));
  await page.route('**/api/config', route => route.fulfill({ json: { google: false, payments: false, uploads: false, categories: [] } }));
  await page.route('**/api/dashboard', route => route.fulfill({ json: { user: account, transactions: empty ? [] : [subscription, ...purchases], artworks: [], users: [], stats: null } }));
}

test('buyer dashboard exposes purchases, collection, subscription tiers and profile management', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await dashboardSession(page);
  await page.goto('/dashboard/user');
  const history = page.getByRole('region', { name: 'Purchase history', exact: true });
  await expect(history.getByRole('columnheader')).toHaveText(['Artwork', 'Artist', 'Price', 'Purchase date']);
  await expect(history.locator('tbody tr')).toHaveCount(5);
  await expect(history).not.toContainText(subscription.title);
  await expect(history.locator('tbody tr').first()).toContainText(['Collected artwork 1', 'Test Artist', '$125', 'Nov 1, 2026'].join(''));
  const collection = page.getByRole('region', { name: 'Bought artworks', exact: true });
  await expect(collection.locator('.collection-card')).toHaveCount(3);
  await expect(collection.locator('.collection-card').first()).toHaveAttribute('href', `/artworks/${purchases[0].artworkId}`);
  await expect(collection.getByRole('img').first()).toHaveAttribute('alt', purchases[0].title);
  const tiers = page.getByRole('region', { name: 'Subscription tier overview' });
  await expect(tiers.locator('tbody tr')).toHaveCount(3);
  for (const [name, limit, price] of [['Free (Default)', '3 paintings', '$0'], ['Pro', '9 paintings', '$9.99'], ['Premium', 'Unlimited', '$19.99']]) {
    const row = tiers.getByRole('row').filter({ hasText: name });
    await expect(row).toContainText(limit);
    await expect(row).toContainText(price);
  }
  await expect(tiers.getByRole('row').filter({ hasText: 'Pro' })).toContainText('Your current plan');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(page.getByRole('region', { name: 'Profile management' })).toBeVisible();
  }
  await page.screenshot({ path: 'test-results/buyer-dashboard-desktop.png', fullPage: true });
  await history.getByRole('link', { name: 'View all purchases' }).click();
  await expect(page.locator('tbody tr')).toHaveCount(6);
  await expect(page.locator('.panel-heading')).toContainText('6 purchases');
  await expect(page.locator('tbody')).not.toContainText(subscription.title);
  await page.goto('/dashboard/user?tab=collection');
  await expect(page.locator('.collection-card')).toHaveCount(6);
  await page.goto('/dashboard/user');
  await page.getByRole('link', { name: 'Edit profile', exact: true }).click();
  await expect(page.getByLabel('Full name', { exact: true })).toHaveValue(user.name);
  await expect(page.getByRole('button', { name: 'Save profile', exact: true })).toBeVisible();
  await page.goto('/dashboard/user');
  await page.getByRole('link', { name: 'Change password', exact: true }).click();
  await expect(page).toHaveURL(/tab=profile#change-password$/);
  await expect(page.getByLabel('Current password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('New password', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Confirm new password', { exact: true })).toBeVisible();
  await page.goto('/dashboard/user');
  await page.getByRole('link', { name: 'Manage membership', exact: true }).click();
  await expect(page.locator('.plan-card')).toHaveCount(3);
  await page.goto('/dashboard/user');
  await page.reload();
  await expect(history).toBeVisible();
  await expect(page.getByRole('link', { name: 'Add artwork', exact: true })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('new buyers see clear purchase and collection empty states alongside their plan options', async ({ page }) => {
  await dashboardSession(page, true);
  await page.goto('/dashboard/user');
  await expect(page.getByRole('region', { name: 'Purchase history', exact: true })).toContainText('Your collection starts here.');
  await expect(page.getByRole('region', { name: 'Bought artworks', exact: true })).toContainText('A collection waiting to happen.');
  await expect(page.getByRole('region', { name: 'Subscription tier overview' }).locator('tbody tr')).toHaveCount(3);
  await expect(page.getByRole('link', { name: 'Edit profile', exact: true })).toBeVisible();
});
