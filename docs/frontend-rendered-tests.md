# Frontend rendered layout checks

From `apps/frontend`, install dependencies with `npm ci`. Install the Chromium browser once, then run the rendered regression:

```bash
npx playwright install --with-deps chromium
npm run test:rendered
```

This separate gate renders actual Navbar and package-card components with their CSS offline in Chromium. It checks header controls, media containment and mobile account access at320/375/768/1440px, including a classic scrollbar and long Vietnamese copy. It needs no application server or backend. External auth/Next primitives are substituted; it does not verify hydration, authentication, bookings or live BFF interactions.

`npm run test` retains the Node-only suite. CI runs `test:rendered` after its existing Chromium installation and before `npm run test:e2e`. Application E2E and actual role/browser acceptance remain separate gates. Browser installation or assertion failures fail CI; there is no skip/fallback.

To save optional screenshots and geometry JSON, set `PUBLIC_SMALL_SCREEN_PROOF_DIR` to an evidence directory before running the rendered command. Omit it for routine verification.
