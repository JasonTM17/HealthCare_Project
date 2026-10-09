import { expect, type Frame } from "@playwright/test";

/** Target actual native business controls, never offscreen accessibility links. */
export async function clickCmsPreviewTransaction(frame: Frame, family: string) {
  const main = frame.getByRole("main");
  if (family === "gop-y") {
    await main.locator("#feedback-subject").fill("Góp ý kiểm thử local");
    await main.locator("#feedback-message").fill("Nội dung kiểm thử local không chứa thông tin cá nhân.");
  }
  const control = family === "dat-lich" ? main.getByRole("button", { name: "Bắt đầu đặt lịch", exact: true })
    : family === "search" ? main.getByRole("button", { name: "Tìm kiếm", exact: true })
    : family === "contact" ? main.getByRole("link", { name: /^Gọi (cấp cứu|cơ sở)(?: →)?$/ }).first()
    : family === "gop-y" ? main.getByRole("button", { name: "Gửi góp ý", exact: true })
    : family === "tra-cuu" ? main.getByRole("button", { name: "Tra cứu ngay", exact: true })
    : family === "careers" ? main.getByRole("button", { name: "Ứng tuyển vị trí này", exact: true }).first()
    : null;
  if (!control) throw new Error(`No planned preview business control for ${family}`);
  await expect(control).toBeVisible();
  await expect(control).toBeEnabled();
  await control.scrollIntoViewIfNeeded();
  await control.click();
}
