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
    await expect(rail.getByRole('button', { name: /Đặt lịch với gói/ })).toHaveCount(4);
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

test('homepage hero recovers after image replacement without clearing the search draft', async ({ context, page }) => {
  const heroPath = '/api/v1/cms/content/homepage.hero';
  const missingImageUrl = '/media/qa-deliberately-missing-hero.jpg';
  let heroContent = {
    slotKey: 'homepage.hero',
    componentType: 'HERO',
    status: 'PUBLISHED',
    version: 101,
    updatedAt: '2026-10-04T00:00:00Z',
    payload: {
      title: 'Synthetic hero artwork',
      body: 'Synthetic image replacement fixture.',
      imageUrl: missingImageUrl,
    },
  };

  await context.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.pathname === heroPath) {
      expect(request.method()).toBe('GET');
      await route.fulfill({ json: heroContent });
    } else if (url.pathname.includes('/hospital/packages')) {
      await route.fulfill({ json: pageEnvelope(MOCK_PACKAGES) });
    } else if (url.pathname.includes('/hospital/')) {
      await route.fulfill({ json: pageEnvelope([]) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
    }
  });
  await installMockBrowserSession(context, null);
  await context.route(`**${missingImageUrl}`, async (route) => {
    await route.fulfill({ status: 404, contentType: 'text/plain', body: 'Synthetic missing artwork' });
  });

  const waitForHeroRead = () => page.waitForResponse((response) => (
    response.request().method() === 'GET' && new URL(response.url()).pathname === heroPath
  ));
  const initialHeroRead = waitForHeroRead();
  const missingImageRead = page.waitForResponse((response) => (
    new URL(response.url()).pathname === missingImageUrl
  ));
  await page.goto('/');
  const initialResponse = await initialHeroRead;
  expect(initialResponse.status()).toBe(200);
  expect(await initialResponse.json()).toMatchObject({ version: 101, payload: { imageUrl: missingImageUrl } });
  expect((await missingImageRead).status()).toBe(404);

  const heroSlot = page.locator('[data-cms-backend-slot="homepage.hero"]');
  const heroImage = heroSlot.locator('.hero-visual__image');
  await expect(heroSlot).toHaveAttribute('data-cms-version', '101');
  await expect(heroImage).toBeVisible();
  await expect(heroImage).toHaveAttribute('src', /hospital-team-landscape\.jpg/);

  const searchInput = page.locator('#hero-search-input');
  const searchDraft = 'Synthetic search draft';
  await searchInput.fill(searchDraft);

  const refreshHeroImage = async (version: number, imageUrl: string) => {
    expect(await page.evaluate(() => document.visibilityState)).toBe('visible');
    heroContent = { ...heroContent, version, payload: { ...heroContent.payload, imageUrl } };
    const heroRead = waitForHeroRead();
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    const response = await heroRead;
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ version, payload: { imageUrl } });
    await expect(heroSlot).toHaveAttribute('data-cms-version', String(version));
    await expect(heroImage).toHaveAttribute('src', imageUrl);
    await expect.poll(() => heroImage.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThanOrEqual(32);
    await expect.poll(() => heroImage.evaluate((image: HTMLImageElement) => image.naturalHeight)).toBeGreaterThanOrEqual(32);
    await expect(searchInput).toHaveValue(searchDraft);
  };

  await refreshHeroImage(102, '/media/about-care-poster.jpg');
  await refreshHeroImage(103, '/media/hospital-team-landscape.jpg');
});
