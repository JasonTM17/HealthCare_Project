import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDir = path.resolve(__dirname, "..");

test("apps/frontend/app/packages/[slug]/page.tsx injects Schema.org MedicalProcedure and Offer", () => {
  const filePath = path.join(frontendDir, "app", "packages", "[slug]", "page.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  assert.ok(content.includes('import { JsonLd } from "../../../components/JsonLd"'), "Should import JsonLd");
  assert.ok(content.includes('"@type": "MedicalProcedure"'), "Should specify MedicalProcedure type");
  assert.ok(content.includes('"@type": "Offer"'), "Should specify Offer type");
  assert.ok(content.includes('priceCurrency: "VND"'), "Should specify VND currency");
  assert.ok(content.includes("<JsonLd data={packageJsonLd}"), "Should render packageJsonLd inside JSX");
});

test("apps/frontend/app/faq/page.tsx injects Schema.org FAQPage for Google Rich Results", () => {
  const filePath = path.join(frontendDir, "app", "faq", "page.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  assert.ok(content.includes('import { JsonLd } from "../../components/JsonLd"'), "Should import JsonLd");
  assert.ok(content.includes('"@type": "FAQPage"'), "Should specify FAQPage type");
  assert.ok(content.includes('"@type": "Question"'), "Should map questions");
  assert.ok(content.includes('"@type": "Answer"'), "Should map answers");
  assert.ok(content.includes("<JsonLd data={faqJsonLd}"), "Should render faqJsonLd inside JSX");
});

test("apps/frontend/app/articles/[slug]/page.tsx injects Schema.org MedicalWebPage with medical author & organization", () => {
  const filePath = path.join(frontendDir, "app", "articles", "[slug]", "page.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  assert.ok(content.includes('import { JsonLd } from "../../../components/JsonLd"'), "Should import JsonLd");
  assert.ok(content.includes('"@type": "MedicalWebPage"'), "Should specify MedicalWebPage type");
  assert.ok(content.includes('"@type": "MedicalOrganization"'), "Should specify publisher MedicalOrganization");
  assert.ok(content.includes("<JsonLd data={articleJsonLd}"), "Should render articleJsonLd inside JSX");
});

test("apps/frontend/app/tra-cuu/page.tsx integrates Google Calendar and .ics reminders with print isolation", () => {
  const filePath = path.join(frontendDir, "app", "tra-cuu", "page.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  assert.ok(content.includes("buildGoogleCalendarUrl"), "Should import and use buildGoogleCalendarUrl");
  assert.ok(content.includes("downloadIcsFile"), "Should import and use downloadIcsFile");
  assert.ok(content.includes('data-testid="tra-cuu-google-calendar"'), "Should provide data-testid for calendar link");
  assert.ok(content.includes('data-testid="tra-cuu-download-ics"'), "Should provide data-testid for .ics download button");
  assert.ok(content.includes("no-print"), "Should isolate print output with no-print classes");
});

test("apps/frontend/components/PortalAppointments.tsx integrates Google Calendar and .ics for confirmed patient visits", () => {
  const filePath = path.join(frontendDir, "components", "PortalAppointments.tsx");
  const content = fs.readFileSync(filePath, "utf-8");

  assert.ok(content.includes("buildGoogleCalendarUrl"), "Should use buildGoogleCalendarUrl");
  assert.ok(content.includes("downloadIcsFile"), "Should use downloadIcsFile");
  assert.ok(content.includes("Google Calendar"), "Should render Google Calendar button");
  assert.ok(content.includes("Tải .ics"), "Should render .ics download button");
});

test("apps/frontend/app/layout.tsx integrates OfflineNetworkIndicator across the platform", () => {
  const layoutPath = path.join(frontendDir, "app", "layout.tsx");
  const indicatorPath = path.join(frontendDir, "components", "OfflineNetworkIndicator.tsx");

  assert.ok(fs.existsSync(indicatorPath), "OfflineNetworkIndicator.tsx must exist");
  const layoutContent = fs.readFileSync(layoutPath, "utf-8");
  assert.ok(layoutContent.includes("OfflineNetworkIndicator"), "layout.tsx must import and render OfflineNetworkIndicator");
});

test("apps/frontend/app/styles.css enforces .no-print and suppresses calendar raw link printing", () => {
  const cssPath = path.join(frontendDir, "app", "styles.css");
  const cssContent = fs.readFileSync(cssPath, "utf-8");

  assert.ok(cssContent.includes(".no-print"), "styles.css must include .no-print in print rules");
  assert.ok(cssContent.includes('[data-testid*="calendar"]'), "styles.css must suppress calendar links in print");
});
