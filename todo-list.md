# Backbone Hub + POS — To-Do List

## Known bugs, not yet fixed
- [ ] Bell sounds not ringing on Bar KDS course completion
- [ ] KDS "Bump to Done" removes ticket prematurely between courses
- [ ] Hub recipe delete failing
- [ ] VAT `|| 20` fallback needs replacing with `?? POS_CONFIG.DEFAULT_VAT_RATE` across ~10 files
- [ ] localhost referrer format issue blocking some auth testing
- [ ] App Check status unconfirmed

## cyber-neo security hardening — still open
### High
- [ ] CN-008 — no security headers on Firebase Hosting
- [ ] CN-010 — `@google/genai` version unpinned (wildcard `*`)
- [x] CN-012 — migrated off the Tailwind CDN script to a real npm build. Installed `tailwindcss` + `@tailwindcss/vite` (v4, mirroring Backbone-POS), added `index.css` entry (`@import "tailwindcss"` + `@theme` block reproducing the exact custom colors/font + `@custom-variant dark` for the `.dark` class + a border-color compat shim for the v3→v4 default change), wired `tailwindcss()` into vite.config.ts, imported the CSS in index.tsx, removed the `<script src="cdn.tailwindcss.com">` + inline `tailwind.config` from index.html. Verified: build emits real 124 KB CSS, all custom color utilities resolve to identical values in light + dark, tsc error count unchanged (15 pre-existing, none new).
### Medium
- [ ] CN-013 — stray `DRAFT_firestore.rules` file in Hub repo root (delete outright — top priority, harmless if unused, dangerous if ever accidentally deployed)
- [ ] CN-015 — Vite `allowedHosts: true` still permissive
- [ ] CN-016/017 — dev-toolchain dependency vulnerabilities (build-time only, lower risk)
### Low
- [ ] CN-020 — `.gitignore` missing key/cert patterns
- [ ] CN-021 — no `storage.rules` tracked
- [ ] CN-023 — unescaped `document.write` in `ExpenseManager.tsx`
- [ ] CN-024 — error handler logs full auth context to console
- [ ] CN-025 — `Math.random()` for staff ID gen (now moot — IDs come from TTP)
- [ ] CN-026 — no CI/CD vulnerability scanning
### Unconfirmed
- [ ] CN-006 / CN-011 — Firebase/lodash transitive dependency vulnerabilities; `npm audit fix` was attempted early on, never fully verified

## Other open items
- [ ] POS's bootstrap function — low priority, mostly dead code now
- [ ] Full staff data audit against TTP once real IDs/PINs are entered
