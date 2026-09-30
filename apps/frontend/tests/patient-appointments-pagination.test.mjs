import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (relativePath) => readFile(new URL(relativePath, root), "utf8");

test("patient appointment list offers a load-more control backed by page totals", async () => {
  const [component, dashboard, styles] = await Promise.all([
    read("components/PortalAppointments.tsx"),
    read("app/patient/dashboard/page.tsx"),
    read("app/styles.css"),
  ]);

  // The patient variant accepts load-more wiring; the doctor variant must not.
  assert.match(component, /onLoadMore\?: \(\) => void;/);
  assert.match(component, /loadingMore\?: boolean;/);
  assert.match(component, /onLoadMore\?: never;/);
  assert.match(component, /loadingMore\?: never;/);
  // The control only appears for the patient viewer when a later page exists.
  assert.match(component, /viewer === "patient" && page\.number \+ 1 < page\.totalPages && onLoadMore/);
  assert.match(component, /Xem thêm lịch hẹn/);
  assert.match(component, /Đang tải\.\.\./);
  assert.match(component, /page\.totalElements/);
  assert.match(component, /disabled=\{loadingMore === true\}/);
  // The dashboard wires the button to a paged fetch of the NEXT page.
  assert.match(dashboard, /onLoadMore=\{handleLoadMoreAppointments\}/);
  assert.match(dashboard, /appendAppointmentPage\(nextPageNumber, current\.size\)/);
  assert.match(dashboard, /fetchPatientAppointments\(nextPageNumber, pageSize\)/);
  assert.match(dashboard, /appointmentsLoadingMore/);
  // A failed page load must say so instead of silently keeping the list short.
  assert.match(dashboard, /Không tải được thêm lịch hẹn/);
  assert.match(styles, /\.portal-appointment-list__more \{/);
});

test("deep-linked appointment ids are searched across every page before declaring them unlinked", async () => {
  const dashboard = await read("app/patient/dashboard/page.tsx");

  assert.match(dashboard, /mergePatientAppointmentPages/);
  assert.match(dashboard, /appointmentFeedFullyLoaded/);
  assert.match(dashboard, /findAppointmentAcrossPages/);
  // Both deep-link kinds resolve through the cross-page scan.
  assert.match(dashboard, /findAppointmentAcrossPages\(paymentAppointmentId\)/);
  assert.match(dashboard, /findAppointmentAcrossPages\(appointmentId\)/);
  // The scan walks the paged feed page by page into the accumulated state.
  assert.match(dashboard, /fetchPatientAppointments\(accumulated\.number \+ 1, accumulated\.size\)/);
  // The "not linked" notice requires the WHOLE feed to be loaded — not just page 0.
  assert.match(dashboard, /appointmentFeedFullyLoaded\(appointments\.data\)/);
  assert.match(dashboard, /Lịch hẹn chưa được liên kết với tài khoản này/);
  // Merge dedupes by appointment id so concurrent scans cannot duplicate rows.
  assert.match(dashboard, /seen\.has\(appointment\.id\)/);
  // A mid-scan fetch failure must clear the handled marker so the scan can retry.
  assert.match(dashboard, /handledPaymentAppointmentIdRef\.current = null/);
});
