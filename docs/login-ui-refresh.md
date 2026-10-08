# Login UI refresh

The `/auth/login` surface uses a calm clinical token set: teal action, blue green neutrals, a 12px control radius, and a 24px desktop card radius. Inputs stay at least 16px on mobile to prevent browser zoom. The role quick select remains an educational demo aid and uses the shared SVG icon family.

The scoped `login.module.css` handles the card, role tabs, password visibility control, focus states, reduced motion, and the 600px mobile composition. Authentication behavior and redirect rules remain in the existing API client.

Validation: `npm run typecheck`, `npm run lint`, `npm run build`, and the focused Playwright `tests/e2e/auth-assistant-responsive.spec.ts` at 320px.

Google remains an official Identity Services button because its branding and account chooser belong to the provider. Its width is capped at 400px by Google's API; a wider email button is therefore expected. Configure Vietnamese on both the library URL and render options, as required by the [Google button guide](https://developers.google.com/identity/gsi/web/guides/display-button#button_language).

Executable owners: [provider button and loader](../apps/frontend/components/GoogleSignInButton.tsx), [proof flow](../apps/frontend/components/google-sign-in-flow.tsx), [shared Google styles](../apps/frontend/components/google-sign-in.module.css), [provider regression tests](../apps/frontend/tests/google-sign-in-button.behavior.test.mjs), [proof regression tests](../apps/frontend/tests/google-proof.behavior.test.mjs). Provider credentials remain component-local; mailbox/password proof must preserve the backend's identity-linking policy.

OAuth setup belongs to the [deployment configuration table](deployment-beta.md). Authorized JavaScript origins must match the browser's actual origin, including scheme and port. For local development at `http://localhost:3000`, authorize that exact origin on the same Web client used by both services; authorize `https://www.healthcare.id.vn` for the public site. A successful button render or account chooser does not prove that Google has issued a credential or that the backend has created a session. Changes to build-time public environment variables require a new frontend build.
