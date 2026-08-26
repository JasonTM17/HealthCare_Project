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
