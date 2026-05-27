import { test, expect } from '@playwright/test';

test.describe('Home page', () => {
  test('renders drop zone', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Drop files here')).toBeVisible();
  });

  test('shows site title', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'ScrubSafe' })).toBeVisible();
  });

  test('has correct page title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/ScrubSafe/);
  });

  test('shows privacy message', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText(/never leave your device/i)).toBeVisible();
  });
});
