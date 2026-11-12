# Backbone Hub

**Repo:** saga00-design/Backbone-Hub
**Inspected:** 2026-11-12
**Status:** Active (last pushed 2026-08-29)

## What It Is
A comprehensive hospitality management platform for restaurants. Covers the full operational back-office: inventory, stock-taking, waste, labour/rota, recipes, menu engineering, POS orders, financial P&L, VAT, supplier management, staff training, and AI-assisted decision making via Gemini. Built as a PWA with Firebase as the backend.

## Tech Stack
- React 18 + TypeScript
- Vite + vite-plugin-pwa
- Tailwind CSS v4 + @tailwindcss/typography
- Firebase (Firestore, Auth, Storage) — firebase@^12.11.0
- @google/genai ^1.45.0 (Gemini AI)
- Recharts (data visualisation)
- jspdf + jspdf-autotable (PDF exports)
- papaparse (CSV import/export)
- html5-qrcode + qrcode.react (barcode scanning)
- Framer Motion / motion
- sonner (toast notifications)
- lucide-react (icons)
- html2canvas (screenshot/export)
- Playwright (E2E testing)
- tailwind-merge

## Structure
```
App.tsx               Root + routing
components/           40+ feature components (see CLAUDE.md for key ones)
hooks/                useConnectionStatus.ts (offline detection)
services/             Business logic + Firebase + AI services
utils/                Utility functions
types.ts              All shared TypeScript types
constants.ts          App-wide constants
firebase.ts           Firebase client init (app, db, auth, storage)
firestore.rules       Firestore security rules
storage.rules         Storage security rules
functions/            Firebase Cloud Functions
seed*.mjs             Database seeding scripts
public/               Static assets
```

## Notable Details
- Has an `audit_results.md` and `security_spec.md` — security was explicitly reviewed
- `FIXLOG.md` and `NEXT_UP.md` — active development tracking
- `todo-list.md` — open tasks
- `rota_export_2026-05-25.csv` — a real rota export left in repo root (not sensitive but worth noting)
- `metadata.json` + `firebase-blueprint.json` — app configuration
- `new_system_data.ts` — likely a data migration/seed file
- Requires `GEMINI_API_KEY` in `.env.local`
- AI Studio app: https://ai.studio/apps/0abfaf17-2a82-42da-82f5-6e3fe4520d0b
