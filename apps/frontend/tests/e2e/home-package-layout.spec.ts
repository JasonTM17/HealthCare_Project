import { test, expect } from '@playwright/test';
import { installMockBrowserSession } from './helpers/browser-session';
const MOCK_PACKAGES = [
  {
    id: "pkg-1",
    name: "Gói khám tổng quát tiêu chuẩn",
    slug: "goi-kham-tong-quat-tieu-chuan",
    price: 2000000,
    description: "Khám sức khỏe tổng quát định kỳ cho người trưởng thành.",
    active: true,
  },
  {
    id: "pkg-2",
    name: "Gói tầm soát tim mạch chuyên sâu",
    slug: "goi-tam-soat-tim-mach-chuyen-sau",
    price: 3500000,
    description: "Đánh giá chức năng tim mạch, điện tâm đồ và siêu âm tim.",
    active: true,
  },
  {
    id: "pkg-3",
    name: "Gói chăm sóc sức khỏe phụ nữ",
    slug: "goi-cham-soc-suc-khoe-phu-nu",
    price: 2500000,
    description: "Khám phụ khoa toàn diện, tầm soát ung thư phụ khoa sớm.",
    active: true,
  },
  {
    id: "pkg-4",
    name: "Gói khám sức khỏe nhi khoa",
    slug: "goi-kham-suc-khoe-nhi-khoa",
    price: 1500000,
    description: "Đánh giá phát triển thể chất và dinh dưỡng cho trẻ nhỏ.",
    active: true,
  },
];

function pageEnvelope<T>(content: T[]) {
  return {
    content,
    totalElements: content.length,
    totalPages: content.length > 0 ? 1 : 0,
    pageNumber: 0,
    pageSize: 50,
  };
}

for (const width of [375, 760, 794, 1080, 1440]) {
  test(`homepage package cards and actions stay fully within their container at ${width}px`, async ({ context, page }, testInfo) => {
    await context.route('**/api/v1/**', async (route) => {
      const url = route.request().url();
      if (url.includes('/hospital/packages')) {
        await route.fulfill({ json: pageEnvelope(MOCK_PACKAGES) });
      } else if (url.includes('/hospital/')) {
        await route.fulfill({ json: pageEnvelope([]) });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
    });
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
