import { test, expect } from '@playwright/test';

test.describe('Critical User Flows', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for app to load
    await page.waitForSelector('[data-screen="DashboardScreen"]', { timeout: 10000 });
  });

  test('Dashboard loads and shows financial overview', async ({ page }) => {
    // Check main dashboard elements
    await expect(page.locator('text=Financial Command Center')).toBeVisible();
    await expect(page.locator('text=Total Financial Net Worth')).toBeVisible();
    
    // Check sphere switcher
    await expect(page.locator('text=Combined')).toBeVisible();
    await expect(page.locator('text=Business')).toBeVisible();
    await expect(page.locator('text=Personal')).toBeVisible();
    await expect(page.locator('text=Family')).toBeVisible();
  });

  test('Can navigate to Cash/Bank accounts screen', async ({ page }) => {
    // Click on Cash in sidebar
    await page.click('text=Bank & Accounts');
    await expect(page.locator('[data-screen="CashScreen"]')).toBeVisible();
    
    // Check accounts are displayed
    await expect(page.locator('text=Bank & Cash Accounts')).toBeVisible();
    await expect(page.locator('text=Add Bank / Cash')).toBeVisible();
  });

  test('Can add a new bank account', async ({ page }) => {
    await page.click('text=Bank & Accounts');
    await page.click('text=Add Bank / Cash');
    
    // Fill account form
    await page.fill('input[placeholder="e.g. SBI Main Branch, Shop Cash Drawer"]', 'Test Bank Account');
    await page.fill('input[placeholder="0.00"]', '10000');
    await page.click('text=Save Account');
    
    // Verify account appears
    await expect(page.locator('text=Test Bank Account')).toBeVisible();
  });

  test('Can record an expense', async ({ page }) => {
    await page.click('text=Expense Manager');
    await expect(page.locator('[data-screen="ExpensesScreen"]')).toBeVisible();
    
    await page.click('text=+ Add Expense');
    await page.fill('input[placeholder="0.00"]', '500');
    await page.fill('input[placeholder="e.g. Office electricity bill, Client lunch, Tea"]', 'Test Expense');
    await page.click('text=Save Expense');
    
    // Verify expense appears
    await expect(page.locator('text=Test Expense')).toBeVisible();
  });

  test('Can navigate to Dues/Udhar screen', async ({ page }) => {
    await page.click('text=Dues & Udhar');
    await expect(page.locator('[data-screen="DuesScreen"]')).toBeVisible();
    
    await expect(page.locator('text=Dues & Udhar Book')).toBeVisible();
    await expect(page.locator('text=Record Due (Udhar)')).toBeVisible();
  });

  test('Can record a new due', async ({ page }) => {
    await page.click('text=Dues & Udhar');
    await page.click('text=Record Due (Udhar)');
    
    // Select contact (if any exists)
    await page.fill('input[placeholder="0.00"]', '1000');
    await page.click('text=Save Due Entry');
    
    // Should show validation error for missing contact
    await expect(page.locator('text=Contact Person')).toBeVisible();
  });

  test('Can navigate to Credit Cards screen', async ({ page }) => {
    await page.click('text=Credit Cards');
    await expect(page.locator('[data-screen="CardsScreen"]')).toBeVisible();
    
    await expect(page.locator('text=Credit Cards & Billed System')).toBeVisible();
  });

  test('Can navigate to Vault screen', async ({ page }) => {
    await page.click('text=Encrypted Vault');
    await expect(page.locator('[data-screen="VaultScreen"]')).toBeVisible();
    
    // Should show locked vault initially
    await expect(page.locator('text=Unlock Secure Digital Vault')).toBeVisible();
  });

  test('Can navigate to Sheets screen', async ({ page }) => {
    await page.click('text=Record Sheets');
    await expect(page.locator('[data-screen="SheetsScreen"]')).toBeVisible();
    
    await expect(page.locator('text=Record Sheets & Excel Grid')).toBeVisible();
  });

  test('Can open AI Receipt Scanner modal', async ({ page }) => {
    await page.click('text=Scan Bill');
    await expect(page.locator('text=AI Receipt & Bill Scanner')).toBeVisible();
    
    // Close modal
    await page.click('button:has(svg)'); // X button
  });

  test('Can open Voice Expense modal', async ({ page }) => {
    await page.click('text=Voice Entry');
    await expect(page.locator('text=AI Voice Accounting')).toBeVisible();
    
    // Close modal
    await page.click('button:has(svg)'); // X button
  });

  test('Can open Quick Transaction modal', async ({ page }) => {
    await page.click('text=+ Inflow');
    await expect(page.locator('text=Record Cash Inflow')).toBeVisible();
    
    await page.click('button:has(svg)'); // X button
    
    await page.click('text=− Expense');
    await expect(page.locator('text=Record Outflow / Expense')).toBeVisible();
  });

  test('Theme toggle works', async ({ page }) => {
    // Find theme toggle button
    const themeButton = page.locator('button[title="Toggle Theme"]');
    await themeButton.click();
    
    // Check dark mode applied
    await expect(page.locator('html.dark')).toBeVisible();
  });

  test('Sync status indicator shows', async ({ page }) => {
    // Should show sync status in navbar
    await expect(page.locator('text=Cloud Synced').or(page.locator('text=Local Mode')).or(page.locator('text=Syncing...'))).toBeVisible();
  });

  test('Mobile navigation works', async ({ page }) => {
    // Resize to mobile
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Mobile nav should be visible
    await expect(page.locator('text=Overview')).toBeVisible();
    await expect(page.locator('text=Bank')).toBeVisible();
    await expect(page.locator('text=Expenses')).toBeVisible();
  });
});

test.describe('App Lock', () => {
  test('App lock can be configured', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-screen="DashboardScreen"]');
    
    // Open backup/restore modal
    await page.click('button[title="Backup, Restore & App Lock"]');
    await expect(page.locator('text=Backup & App Lock')).toBeVisible();
    
    // Should have app lock section
    await expect(page.locator('text=App Lock')).toBeVisible();
  });
});

test.describe('Data Persistence', () => {
  test('LocalStorage data persists across reload', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-screen="DashboardScreen"]');
    
    // Add an expense
    await page.click('text=Expense Manager');
    await page.click('text=+ Add Expense');
    await page.fill('input[placeholder="0.00"]', '1234');
    await page.fill('input[placeholder="e.g. Office electricity bill, Client lunch, Tea"]', 'Persistence Test');
    await page.click('text=Save Expense');
    
    // Reload page
    await page.reload();
    await page.waitForSelector('[data-screen="DashboardScreen"]');
    
    // Navigate to expenses
    await page.click('text=Expense Manager');
    await expect(page.locator('text=Persistence Test')).toBeVisible();
  });
});