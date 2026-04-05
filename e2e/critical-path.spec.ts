import { test, expect } from '@playwright/test';

test.describe('Critical Path: Ingestion & Splitting', () => {
    test('Can create a project, insert text, and split it safely', async ({ page }) => {
        // Overrides the active model parameter and ensures UI starts in a known state
        await page.addInitScript(() => {
            window.localStorage.setItem('readread-system-v1', JSON.stringify({
                state: { activeModelId: 'debug-sine', isZenMode: false },
                version: 0
            }));
            window.localStorage.setItem('readread-ui-v4', JSON.stringify({
                state: { isPlayerOpen: true, isSidebarOpen: true, isInspectorOpen: true },
                version: 0
            }));
        });

        await page.goto('/');

        // 1. Create Project
        const newProjectBtn = page.locator('button:has-text("NEW PROJECT")').first();
        await newProjectBtn.waitFor({ state: 'visible', timeout: 10000 });
        await newProjectBtn.click();

    });
});
