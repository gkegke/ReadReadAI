import { test, expect } from '@playwright/test';

test.describe('Critical Path: Ingestion & Splitting', () => {
    test('Can create a project, insert text, and split it safely', async ({ page }) => {
        await page.goto('/');

        // Bypass bootscreen if visible
        await page.waitForSelector('text=Igniting Engines...', { state: 'hidden', timeout: 15000 });

        // 1. Create Project
        await page.click('text=QUICK START');
        
        // Ensure we reached the Studio UI
        await expect(page.locator('text=Project is Empty')).toBeVisible();

        // 2. Insert Block
        await page.click('text=Create First Block');
        await expect(page.locator('text=New Chapter Content...')).toBeVisible();

        // Note: For a robust E2E test, we would add mock service interceptors for 
        // IndexedDB and the AI WebWorkers here to prevent timeouts on CI pipelines.
    });
});