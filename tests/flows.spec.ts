import { test, expect, Page } from '@playwright/test';
async function login(page: Page, role: 'buyer' | 'artist' | 'admin') {
  await page.goto('/login'); await page.locator('.auth-form-wrap').getByLabel('Email address', { exact: true }).fill(`${role}@arthub.com`); await page.getByLabel('Password', { exact: true }).fill(role === 'admin' ? 'Admin@123' : 'ArtHub@123'); await page.getByRole('button', { name: 'Sign in', exact: true }).click(); await expect(page.getByRole('button', { name: 'Account menu' })).toBeVisible();
}
test('gallery search, category filters, pagination and mobile layout', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await expect(page.locator('.art-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'Next artwork' }).click(); await expect(page.locator('.hero-art-caption h2')).toHaveText('Painting with Green Center');
  await page.goto('/browse'); await expect(page.locator('.art-card')).toHaveCount(12);
  await page.getByLabel('Search by title or artist').fill('Roses'); await page.getByRole('button', { name: 'Search', exact: true }).click(); await expect(page.locator('.art-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Printmaking', exact: true }).click(); await expect(page.getByRole('heading', { name: 'A fresh canvas' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click(); await expect(page.locator('.art-card')).toHaveCount(12);
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await page.getByLabel('Include sold artworks').check();
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await page.getByRole('button', { name: 'Next page' }).click(); await expect(page.locator('.art-card')).toHaveCount(2);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/browse', '/membership', '/login', '/register']) { await page.goto(path); await expect(page.locator('h1')).toBeVisible(); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); }
  }
  expect(errors).toEqual([]);
});
test('buyer session survives reload, wishlist persists, and purchased artwork comments support CRUD', async ({ page }) => {
  await login(page, 'buyer'); await page.goto('/dashboard/user?tab=collection'); await expect(page.locator('.collection-card')).toHaveCount(2); await page.reload(); await expect(page.locator('.collection-card')).toHaveCount(2); expect(page.url()).toContain('/dashboard/user');
  const response = await page.request.get('/api/dashboard'); const dashboard = await response.json(); const id = dashboard.transactions.find((t: { type: string; artworkId: string }) => t.type === 'purchase').artworkId;
  await page.goto(`/artworks/${id}`); await expect(page.getByLabel('What speaks to you about this piece?')).toBeVisible();
  const comment = `Playwright collector thought ${Date.now()}`; await page.getByLabel('What speaks to you about this piece?').fill(comment); await page.getByRole('button', { name: 'Post comment' }).click(); const row = page.locator('.comment').filter({ hasText: comment }); await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Edit', exact: true }).click(); await page.getByLabel('Edit your comment').fill(`${comment} edited`); await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await expect(page.locator('.comment').filter({ hasText: `${comment} edited` })).toBeVisible();
  await page.locator('.comment').filter({ hasText: comment }).getByRole('button', { name: 'Delete', exact: true }).click(); await expect(page.locator('.comment').filter({ hasText: comment })).toHaveCount(0);
  const saved = (await (await page.request.get('/api/auth/me')).json()).wishlist.includes(id); await page.getByRole('button', { name: saved ? 'Remove from wishlist' : 'Save to wishlist', exact: true }).click(); await expect(page.getByRole('button', { name: saved ? 'Save to wishlist' : 'Remove from wishlist', exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('button', { name: saved ? 'Save to wishlist' : 'Remove from wishlist', exact: true })).toBeVisible(); await page.getByRole('button', { name: saved ? 'Save to wishlist' : 'Remove from wishlist', exact: true }).click();
  await page.goto('/dashboard/user?tab=membership'); await expect(page.locator('.plan-card')).toHaveCount(3);
});
test('artist creates, edits and deletes an original artwork', async ({ page }) => {
  await login(page, 'artist'); await page.goto('/dashboard/artist/artworks/new'); let id = '';
  try {
    const title = `Studio browser verification ${Date.now()}`; await page.getByLabel('Or paste an image URL').fill('http://localhost:3000/artworks/aic-8987.webp'); await page.getByLabel('Artwork title', { exact: true }).fill(title); await page.getByLabel('The story behind it').fill('An original artwork listing for verifying the complete artist studio flow.'); await page.getByLabel('Price (USD)').fill('125'); await page.getByLabel('Category', { exact: true }).selectOption('Painting'); await page.getByRole('button', { name: 'Publish artwork', exact: true }).click();
    await expect(page).toHaveURL(/\/artworks\/[a-f0-9]{24}$/); id = page.url().split('/').pop()!; await expect(page.locator('h1')).toHaveText(title);
    await page.getByRole('link', { name: 'Edit artwork', exact: true }).click(); await expect(page.getByLabel('Artwork title', { exact: true })).toHaveValue(title); await page.getByLabel('Price (USD)').fill('150'); await page.getByRole('button', { name: 'Save changes', exact: true }).click(); await expect(page.locator('.detail-price')).toContainText('$150');
    await page.getByRole('button', { name: 'Delete', exact: true }).click(); await page.getByRole('dialog').getByRole('button', { name: 'Delete artwork', exact: true }).click(); await expect(page).toHaveURL('/dashboard/artist'); await expect(page.locator('h1')).toHaveText('Welcome to your studio.');
  } finally { if (id) await page.request.delete(`/api/artworks/${id}`); }
});
test('admin analytics and role management render on desktop and mobile', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message)); await login(page, 'admin'); await expect(page.locator('.stat-card')).toHaveCount(4); await expect(page.locator('.recharts-wrapper')).toHaveCount(2); await page.goto('/dashboard/admin?tab=users'); await expect(page.locator('.table-role')).toHaveCount(5);
  for (const width of [390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); for (const tab of ['overview', 'users', 'artworks', 'transactions', 'profile']) { await page.goto(`/dashboard/admin?tab=${tab}`); await expect(page.locator('.dashboard-heading')).toBeVisible(); await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true); } }
  expect(errors).toEqual([]);
});

test('role-specific dashboard disclosure supports navigation, Escape and mobile', async ({ page }) => {
  for (const role of ['buyer', 'artist', 'admin'] as const) {
    await page.request.post('/api/auth/logout'); await login(page, role);
    const trigger = page.getByRole('button', { name: 'Dashboard', exact: true });
    await trigger.click(); await expect(trigger).toHaveAttribute('aria-expanded', 'true');
    const links = page.locator('#dashboard-nav-links');
    await expect(links.getByRole('link', { name: role === 'buyer' ? 'Purchase history' : role === 'artist' ? 'Sales history' : 'Manage users', exact: true })).toBeVisible();
    await expect(links.getByRole('link', { name: role === 'admin' ? 'Purchase history' : 'Manage users', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape'); await expect(trigger).toBeFocused(); await expect(links).toHaveCount(0);
    await page.setViewportSize({ width: 390, height: 900 });
    await page.getByRole('button', { name: 'Toggle navigation' }).click(); await trigger.click();
    await links.getByRole('link', { name: 'My profile', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/dashboard/${role === 'buyer' ? 'user' : role}\\?tab=profile$`));
    await expect(page.getByLabel('Full name', { exact: true })).toBeVisible();
    await expect(page.locator('.main-nav')).toBeHidden();
    await page.setViewportSize({ width: 1440, height: 900 });
  }
});

test('dashboard table skeleton and catalog error toast recover after loading', async ({ page }) => {
  await login(page, 'admin');
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/dashboard', async route => { await gate; await route.continue(); });
  try {
    await page.goto('/dashboard/admin?tab=users');
    await expect(page.getByRole('status', { name: 'Loading table' })).toBeVisible();
  } finally { release(); }
  await expect(page.locator('.table-role')).toHaveCount(5);
  await page.unroute('**/api/dashboard');
  await page.route('**/api/artworks?*', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Catalog temporarily offline' }) }));
  await page.goto('/browse');
  await expect(page.locator('.toast-error')).toContainText('Catalog temporarily offline');
  await expect(page.getByRole('button', { name: 'Try again', exact: true })).toBeVisible();
  await page.unroute('**/api/artworks?*'); await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await expect(page.locator('.art-card')).toHaveCount(12);
  await page.goto('/dashboard/admin');
  await expect(page.locator('.stat-card').filter({ hasText: 'Total artists' }).locator('strong')).toHaveText('3');
});

test('wishlist cart persists and checkout loading recovers from payment unavailability', async ({ page, browser }) => {
  const artist = await browser.newContext(); let id = '';
  try {
    await artist.request.post('http://localhost:3000/api/auth/login', { data: { email: 'artist@arthub.com', password: 'ArtHub@123' } });
    const response = await artist.request.post('http://localhost:3000/api/artworks', { data: { title: `Cart browser verification ${Date.now()}`, description: 'An original artwork listing used to verify saving and cart checkout.', price: 75, category: 'Digital', image: 'http://localhost:3000/artworks/aic-8987.webp' } });
    expect(response.status()).toBe(201); id = (await response.json())._id;
    await login(page, 'buyer'); await page.request.post(`/api/wishlist/${id}`);
    await page.goto('/wishlist'); const card = page.locator('.art-card').filter({ has: page.getByRole('link', { name: /Cart browser verification/ }) });
    await card.getByRole('button', { name: 'Add to Cart', exact: true }).click();
    await card.getByRole('link', { name: 'View cart', exact: true }).click();
    await expect(page).toHaveURL('/cart');
    await expect(page.locator('.art-card')).toHaveCount(1); await page.reload(); await expect(page.locator('.art-card')).toHaveCount(1);
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
    await page.route('**/api/checkout', async route => { await gate; await route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ message: 'Payment service is unavailable' }) }); });
    try { await page.getByRole('button', { name: 'Checkout', exact: true }).click(); await expect(page.locator('.payment-loading').getByRole('status')).toContainText('Opening secure checkout'); }
    finally { release(); }
    await expect(page.locator('.toast-error')).toContainText('Payment service is unavailable');
    await expect(page.locator('.payment-loading')).toHaveCount(0);
    await page.getByRole('button', { name: /Remove .* from cart/ }).click();
    await expect(page.getByRole('heading', { name: 'Your next discovery is waiting.' })).toBeVisible();
  } finally {
    if (id) { await page.request.delete(`/api/cart/${id}`); await page.request.delete(`/api/wishlist/${id}`); await artist.request.delete(`http://localhost:3000/api/artworks/${id}`); }
    await artist.close();
  }
});
