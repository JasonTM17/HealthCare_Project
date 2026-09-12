import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const packageBookingModalPath = new URL("../components/PackageBookingModal.tsx", import.meta.url);
const packagesPagePath = new URL("../app/packages/page.tsx", import.meta.url);
const packageDetailPagePath = new URL("../app/packages/[slug]/page.tsx", import.meta.url);
const searchPagePath = new URL("../app/search/SearchPageClient.tsx", import.meta.url);

test("PackageBookingModal exports proper types and tailored 4-step wizard", async () => {
  const source = await readFile(packageBookingModalPath, "utf8");

  // Types export
  assert.match(source, /export type PackageItem = HealthPackage;/);
  assert.match(source, /export interface PackageBookingModalProps/);
  assert.match(source, /packageItem: PackageItem/);
  assert.match(source, /branches\?: Branch\[\]/);

  // 4 Steps definition bypassing specialty and doctor selection
  assert.match(source, /PACKAGE_BOOKING_STEPS = \[/);
  assert.match(source, /label: "Cơ sở y tế"/);
  assert.match(source, /label: "Ngày & Giờ tiếp nhận"/);
  assert.match(source, /label: "Thông tin người khám"/);
  assert.match(source, /label: "Xác nhận & Phiếu khám"/);
  assert.doesNotMatch(source, /label: "Chuyên khoa"/);
  assert.doesNotMatch(source, /label: "Bác sĩ"/);

  // Immutable top banner
  assert.match(source, /Gói khám đã chọn/);
  assert.match(source, /Chi phí trọn gói/);
  assert.match(source, /packageItem\.name/);
  assert.match(source, /currency\(packageItem\.price\)/);

  // Calls holdAppointmentSlot and confirmAppointment
  assert.match(source, /holdAppointmentSlot\(\{/);
  assert.match(source, /packageId: packageItem\.id/);
  assert.match(source, /branchId: activeBranchId/);
  assert.match(source, /confirmAppointment\(\{/);
  assert.match(source, /bookingCode/);

  // Electronic Appointment Ticket & preparation guidelines
  assert.match(source, /PHIẾU ĐĂNG KÝ GÓI KHÁM ĐIỆN TỬ/);
  assert.match(source, /MÃ PHIẾU KHÁM/);
  assert.match(source, /Hướng dẫn chuẩn bị trước khi đến khám/);
  assert.match(source, /packageItem\.preparationSteps/);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
});

test("packages catalog (/packages) synchronizes 'Đặt lịch với gói này' on all package cards", async () => {
  const source = await readFile(packagesPagePath, "utf8");

  assert.match(source, /PackageBookingModal/);
  assert.match(source, /selectedPackageForModal/);
  assert.match(source, /Đặt lịch với gói này/);
  assert.match(source, /onClick=\{\(\) => setSelectedPackageForModal\(item\)\}/);
  assert.match(source, /<PackageBookingModal/);
});

test("package detail (/packages/[slug]) synchronizes hero and bottom CTA buttons to PackageBookingModal", async () => {
  const source = await readFile(packageDetailPagePath, "utf8");

  assert.match(source, /PackageBookingModal/);
  assert.match(source, /packageBookingOpen/);
  assert.match(source, /onBookingRequest=\{\(\) => setPackageBookingOpen\(true\)\}/);
  assert.match(source, /Đặt lịch với gói này/);
  assert.match(source, /onClick=\{\(\) => setPackageBookingOpen\(true\)\}/);
  assert.match(source, /<PackageBookingModal/);
});

test("search results (/search) includes 'Đặt lịch với gói này' for every package result", async () => {
  const source = await readFile(searchPagePath, "utf8");

  assert.match(source, /PackageBookingModal/);
  assert.match(source, /selectedPackageForModal/);
  assert.match(source, /result\.packages\.map/);
  assert.match(source, /Đặt lịch với gói này/);
  assert.match(source, /onClick=\{\(\) => setSelectedPackageForModal\(item\)\}/);
  assert.match(source, /<PackageBookingModal/);
});
