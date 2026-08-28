# Backbone Hub + POS — To-Do List

## Known bugs, not yet fixed
- [ ] Bell sounds not ringing on Bar KDS course completion
- [ ] KDS "Bump to Done" removes ticket prematurely between courses
- [ ] Hub recipe delete failing
- [x] VAT `|| 20` fallback replaced with `?? DEFAULT_VAT_RATE` (constants.ts) in App.tsx + MenuRecipes.tsx (12 instances). Still open: same-class bug in services/closureService.ts:287 (legacy field-recovery chain, deliberately left alone — different fix shape), and the mirror fix in Backbone-POS (separate repo, not covered here).
- [ ] localhost referrer format issue blocking some auth testing
- [ ] App Check status unconfirmed

## cyber-neo security hardening — still open
### High
- [x] CN-008 — added security headers to Firebase Hosting (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, HSTS, Permissions-Policy). Deploys on next irebase deploy.
- [ ] CN-010 — `@google/genai` version unpinned (wildcard `*`)
- [x] CN-012 — migrated off the Tailwind CDN script to a real npm build. Installed `tailwindcss` + `@tailwindcss/vite` (v4, mirroring Backbone-POS), added `index.css` entry (`@import "tailwindcss"` + `@theme` block reproducing the exact custom colors/font + `@custom-variant dark` for the `.dark` class + a border-color compat shim for the v3→v4 default change), wired `tailwindcss()` into vite.config.ts, imported the CSS in index.tsx, removed the `<script src="cdn.tailwindcss.com">` + inline `tailwind.config` from index.html. Verified: build emits real 124 KB CSS, all custom color utilities resolve to identical values in light + dark, tsc error count unchanged (15 pre-existing, none new).
### Medium
- [x] CN-013 — deleted stray `DRAFT_firestore.rules` (open `allow read, write: if true` stub). Confirmed unused first: `firebase.json` points both databases at `firestore.rules` only, no script/`.firebaserc` reference; the real 15 KB `firestore.rules` is untouched.
- [x] CN-015 — Vite `allowedHosts` changed from `true` (accept any Host header) to `[]`. Elliott confirmed dev is localhost-only; Vite still always allows `localhost` + bare IP hosts, so `npm run dev` is unaffected. Verified: localhost/127.0.0.1 → 200, spoofed `Host: evil.example.com` → 403 (was 200). Was a leftover from the AI Studio scaffold (de73405).
- [x] CN-016/017 — ran `npm audit fix` (safe, non-breaking): 13 → 2 vulns. Bumped lockfile-only (ws, websocket-driver, protobufjs, postcss, nanoid, lodash, brace-expansion, fast-uri, @grpc/grpc-js, @babel/core) — no `package.json` version changes, tsc/build/dev all still green. **Remaining 2 (esbuild ≤0.24.2 + vite depending on it, both dev-server-only) need `vite@8` — a major bump left as a deliberate decision, not auto-applied.**
### Low
- [ ] CN-020 — `.gitignore` missing key/cert patterns
- [ ] CN-021 — no `storage.rules` tracked
- [x] CN-023 - replaced document.write string-interpolation (XSS risk if receiptImageUrl was ever malicious) with safe DOM construction in ExpenseManager.tsx
- [x] CN-024 - narrower than framed: only logs auth UID, locally, on permission-denied. Gated behind import.meta.env.DEV so it never logs in production
- [ ] CN-025 — `Math.random()` for staff ID gen (now moot — IDs come from TTP)
- [x] CN-026 - added .github/dependabot.yml (weekly dependency update PRs, root + functions) and .github/workflows/security-audit.yml (runs npm audit --audit-level=high on every push/PR to main plus weekly, fails the build on new high/critical vulns)
### Unconfirmed
- [x] CN-006 / CN-011 — Firebase/lodash transitive dependency vulnerabilities. Resolved by the CN-016/017 `npm audit fix` pass (lodash 4.17.23→4.18.1, plus firebase's grpc-js/protobufjs/ws/websocket-driver transitives). Verified: `npm audit` now reports only the 2 esbuild/vite dev-server findings.

## Other open items
- [ ] POS's bootstrap function — low priority, mostly dead code now
- [ ] Full staff data audit against TTP once real IDs/PINs are entered
