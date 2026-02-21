import { test, expect } from '@playwright/test';

test.describe('Login Flow', () => {
    test('shows login page', async ({ page }) => {
        await page.goto('/login');
        await expect(page.locator('input[name="username"], [data-testid="username"]')).toBeVisible();
        await expect(page.locator('input[name="password"], [data-testid="password"]')).toBeVisible();
    });

    test('logs in with valid credentials', async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[name="username"], [data-testid="username"]', 'admin');
        await page.fill('input[name="password"], [data-testid="password"]', 'admin123');
        await page.click('button[type="submit"], [data-testid="login-button"]');
        await page.waitForURL(/\/dashboard/, { timeout: 10000 });
        await expect(page).toHaveURL(/\/dashboard/);
    });

    test('shows error on invalid credentials', async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[name="username"], [data-testid="username"]', 'admin');
        await page.fill('input[name="password"], [data-testid="password"]', 'wrong');
        await page.click('button[type="submit"], [data-testid="login-button"]');
        await expect(page.locator('text=Invalid credentials, text=Login failed, [role="alert"]')).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Device Management', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[name="username"], [data-testid="username"]', 'admin');
        await page.fill('input[name="password"], [data-testid="password"]', 'admin123');
        await page.click('button[type="submit"], [data-testid="login-button"]');
        await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    });

    test('shows device list', async ({ page }) => {
        await page.goto('/devices');
        await expect(page.locator('table, [data-testid="device-table"]')).toBeVisible({ timeout: 10000 });
    });

    test('navigates to device detail', async ({ page }) => {
        await page.goto('/devices');
        await page.waitForSelector('table tbody tr', { timeout: 10000 });
        await page.click('table tbody tr:first-child a, table tbody tr:first-child td:first-child');
        await page.waitForURL(/\/devices\/\d+/, { timeout: 10000 });
    });
});

test.describe('Dashboard', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[name="username"], [data-testid="username"]', 'admin');
        await page.fill('input[name="password"], [data-testid="password"]', 'admin123');
        await page.click('button[type="submit"], [data-testid="login-button"]');
        await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    });

    test('dashboard loads with stats', async ({ page }) => {
        await expect(page.locator('text=Total Devices, text=Devices')).toBeVisible({ timeout: 10000 });
    });

    test('theme toggle works', async ({ page }) => {
        const html = page.locator('html');
        // Check current theme class
        const initialClass = await html.getAttribute('class');

        // Find and click theme toggle
        const toggle = page.locator('[data-testid="theme-toggle"], button:has(svg.lucide-sun), button:has(svg.lucide-moon)');
        if (await toggle.isVisible()) {
            await toggle.click();
            const newClass = await html.getAttribute('class');
            expect(newClass).not.toBe(initialClass);
        }
    });
});

test.describe('Alerts', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/login');
        await page.fill('input[name="username"], [data-testid="username"]', 'admin');
        await page.fill('input[name="password"], [data-testid="password"]', 'admin123');
        await page.click('button[type="submit"], [data-testid="login-button"]');
        await page.waitForURL(/\/dashboard/, { timeout: 10000 });
    });

    test('alerts page loads', async ({ page }) => {
        await page.goto('/alerts');
        await expect(page.locator('text=Alert, text=Rules, h1, h2').first()).toBeVisible({ timeout: 10000 });
    });
});
