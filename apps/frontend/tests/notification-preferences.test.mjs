import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("notification preferences matrix keeps the new contract and legacy API side-by-side", async () => {
  const [api, page, styles, types] = await Promise.all([
    read("lib/api-client.ts"),
    read("app/patient/preferences/page.tsx"),
    read("app/styles.css"),
    read("types/hospital.ts"),
  ]);

  assert.match(api, /\/users\/me\/notification-preferences/);
  assert.match(api, /fetchNotificationPreferences/);
  assert.match(api, /updateNotificationPreference/);
  assert.match(api, /\/users\/me\/preferences/);

  assert.match(page, /BẮT BUỘC/);
  assert.match(page, /Khóa/);
  assert.match(page, /Không có thay đổi nào cần lưu\./);
  assert.match(page, /Không thể tải cấu hình thông báo/);
  assert.match(page, /Giờ yên tĩnh/);
  assert.match(page, /saveEpoch/);
  assert.match(page, /AbortController/);
  assert.doesNotMatch(page, /localStorage|sessionStorage|Authorization|Bearer/);

  assert.match(styles, /notification-preferences-grid/);
  assert.match(styles, /notification-preference-card/);
  assert.match(styles, /@media \(min-width:\s*768px\)/);
  assert.match(styles, /@media \(min-width:\s*1440px\)/);

  assert.match(types, /export type NotificationCategory/);
  assert.match(types, /export type NotificationChannel/);
  assert.match(types, /export interface NotificationPreference/);
  assert.match(types, /NotificationPreferencePatchPayload/);
});
