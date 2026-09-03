# Login UI refresh

The `/auth/login` surface uses a calm clinical token set: teal action, blue green neutrals, a 12px control radius, and a 24px desktop card radius. Inputs stay at least 16px on mobile to prevent browser zoom. The role quick select remains an educational demo aid and uses the shared SVG icon family.

The scoped `login.module.css` handles the card, role tabs, password visibility control, focus states, reduced motion, and the 600px mobile composition. Authentication behavior and redirect rules remain in the existing API client.

Validation: `npm run typecheck`, `npm run lint`, `npm run build`, and the focused Playwright `tests/e2e/auth-assistant-responsive.spec.ts` at 320px.
