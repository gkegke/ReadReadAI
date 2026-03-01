import { test, expect } from '@playwright/test';

test.describe('Critical Path: Ingestion & Splitting', () => {
    test('Can create a project, insert text, and split it safely', async ({ page }) => {
        // [EPIC 6] Mock Framework Seed: 
        // Overrides the active model parameter using initial state injection
        await page.addInitScript(() => {
            window.localStorage.setItem('readread-system-v1', JSON.stringify({
                state: { activeModelId: 'debug-sine', isZenMode: false },
                version: 0
            }));
        });

        await page.goto('/');

        // Click "Ignite Engines" on BootScreen
        const igniteBtn = page.locator('text=Ignite Engines');
        await igniteBtn.waitFor({ state: 'visible', timeout: 5000 });
        await igniteBtn.click();

        // Bypass bootscreen if visible after ignition
        await page.waitForSelector('text=Igniting Engines...', { state: 'hidden', timeout: 15000 });

        // 1. Create Project via Quick Start
        await page.click('text=QUICK START');
        
        // Ensure we reached the Studio UI empty state block
        const insertInput = page.locator('textarea[placeholder="Insert thoughts here..."]');
        await insertInput.waitFor({ state: 'visible', timeout: 10000 });

        // 2. Insert Block
        await insertInput.fill('This is a test document for end-to-end processing.');
        await page.click('text=Insert');

        // Wait for generation to complete (DummyEngine handles this instantly)
        const chunkPlayBtn = page.locator('button[title="Play / Pause (Spacebar)"]').first();
        await expect(chunkPlayBtn).toBeVisible({ timeout: 10000 });

        // 3. Edit & Split Block Safely
        const chunkText = page.locator('p').filter({ hasText: 'This is a test document' }).first();
        await chunkText.dblclick();

        const settingsBtn = page.locator('button').filter({ has: page.locator('svg.lucide-settings-2') }).first();
        await settingsBtn.click();
        await page.click('text=Split Block');

        // We should now have 2 discrete chunk paragraphs populated
        const chunks = page.locator('p.cursor-text');
        await expect(chunks).toHaveCount(2);
    });
});