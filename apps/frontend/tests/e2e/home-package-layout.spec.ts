import { test, expect } from '@playwright/test';
import { installMockBrowserSession } from './helpers/browser-session';
for (const width of [375, 760, 794, 1080, 1440]) {
  test(`homepage package cards and actions stay fully within their container at ${width}px`, async ({ context, page }, testInfo) => {
    await context.route('**/api/v1/**', route => route.fulfill({status:503,contentType:'application/json',body:'{}'}));
    await installMockBrowserSession(context, null);
    await page.setViewportSize({width,height:900});
    await page.goto('/');
    const rail = page.getByRole('region', { name: 'Gói khám sức khỏe', exact: true });
    await expect(rail.locator('article')).toHaveCount(4);
    await expect(rail.getByRole('button', { name: 'Đặt lịch', exact: true })).toHaveCount(4);
    const bounds = await rail.boundingBox();
    const cards = await rail.locator('article').evaluateAll((nodes) => nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      const button = node.querySelector<HTMLButtonElement>('button');
      if (!button) throw new Error('Missing booking button');
      const action = button.getBoundingClientRect();
      return {
        x: rect.x,
        width: rect.width,
        buttonX: action.x,
        buttonRight: action.right,
        buttonWidth: action.width,
        buttonHeight: action.height,
      };
    }));
    for (const card of cards) {
      expect(card.x).toBeGreaterThanOrEqual(bounds!.x - 1);
      expect(card.x + card.width).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
      expect(card.buttonX).toBeGreaterThanOrEqual(0);
      expect(card.buttonRight).toBeLessThanOrEqual(width);
      expect(card.buttonWidth).toBeGreaterThan(0);
      expect(card.buttonHeight).toBeGreaterThan(0);
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
    await rail.scrollIntoViewIfNeeded();
    await page.screenshot({path:testInfo.outputPath('packages.png')});
  });
}
