import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("public Navbar mobile navigation has a labelled dialog and complete keyboard return path", async () => {
  const source = await read("components/Navbar.tsx");

  assert.match(source, /<a className="skip-link" href="#main-content">/);
  assert.match(source, /<nav aria-label="Điều hướng chính"/);
  assert.match(source, /<nav aria-label="Điều hướng trên thiết bị nhỏ"/);
  assert.match(source, /aria-expanded=\{mobileMenuOpen\}/);
  assert.match(source, /aria-controls="mobile-navigation"/);
  assert.match(source, /aria-label=\{mobileMenuOpen \? "Đóng menu" : "Mở menu"\}/);
  assert.match(source, /<div aria-label="Menu điều hướng" aria-modal="true"[^>]*id="mobile-navigation"[^>]*role="dialog"/);
  assert.match(source, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(source, /<Link aria-label=\{accountDestination\.label\} className="nav-account-link"/);
  assert.match(source, /<button aria-label="Đặt lịch khám" className="button button--nav"/);

  assert.match(source, /const previouslyFocused = document\.activeElement instanceof HTMLElement/);
  assert.match(source, /const focusableSelector = "a\[href\], button:not\(\[disabled\]\), input/);
  assert.match(source, /const focusFrame = window\.requestAnimationFrame\(\(\) => getFocusable\(\)\[0\]\?\.focus\(\)\)/);
  assert.match(source, /document\.addEventListener\("keydown", handleKeyDown\)/);
  assert.match(source, /if \(event\.key === "Escape"\)[\s\S]*?event\.preventDefault\(\);[\s\S]*?setMobileMenuOpen\(false\)/);
  assert.match(source, /event\.shiftKey && document\.activeElement === first[\s\S]*?last\.focus\(\)/);
  assert.match(source, /!event\.shiftKey && document\.activeElement === last[\s\S]*?first\.focus\(\)/);
  assert.match(source, /document\.body\.style\.overflow = "hidden"/);
  assert.match(source, /document\.body\.style\.overflow = previousOverflow/);
  assert.match(source, /if \(previouslyFocused\?\.isConnected\) previouslyFocused\.focus\(\);/);
  assert.match(source, /else menuButton\?\.focus\(\);/);
  assert.match(source, /document\.removeEventListener\("keydown", handleKeyDown\)/);
});

test("Navbar actions close the menu and keep interactive targets touch-safe", async () => {
  const [source, styles] = await Promise.all([
    read("components/Navbar.tsx"),
    read("app/styles.css"),
  ]);

  assert.match(source, /onClick=\{closeMobileMenu\}/);
  assert.match(source, /closeMobileMenu\(\); onOpenBooking\(\);/);
  assert.match(styles, /\.nav-link\s*\{[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /\.nav-account-link,[\s\S]*?\.nav-menu-button\s*\{[\s\S]*?min-width:\s*44px[\s\S]*?min-height:\s*44px/);
  assert.match(styles, /\.button--nav\s*\{[\s\S]*?min-height:\s*46px/);
  assert.match(styles, /\.mobile-menu__link\s*\{[\s\S]*?min-height:\s*48px/);
  assert.match(styles, /a:focus-visible,[\s\S]*?button:focus-visible,[\s\S]*?outline:\s*3px solid/);
});

test("booking progress remains named and keyboard reachable when it scrolls", async () => {
  const source = await read("components/BookingModal.tsx");

  assert.match(source, /aria-label="Tiến trình đặt lịch, có thể cuộn ngang"/);
  assert.match(source, /className="flex items-center gap-2 overflow-x-auto text-xs font-semibold text-brand-900"/);
  assert.match(source, /role="region" tabIndex=\{0\}/);
});

test("public light and dark surfaces keep text-button contrast scoped", async () => {
  const styles = await read("app/styles.css");

  assert.match(styles, /\.site-shell \.resource-muted\s*\{[\s\S]*?color:\s*#5f6969\s*!important/);
  assert.match(styles, /\.site-shell \.resource-breadcrumb > span\s*\{[\s\S]*?color:\s*#5f6969/);
  assert.match(styles, /\.site-shell \.video-card \.text-button\s*\{[\s\S]*?color:\s*#bce4dc/);
  assert.match(styles, /\.site-shell \.hero-search__help\s*\{[\s\S]*?color:\s*var\(--hospital-muted\)/);
  assert.match(styles, /\.site-shell \.booking-panel__progress \.text-gray-400\s*\{[\s\S]*?color:\s*var\(--hospital-muted\)\s*!important/);
});
