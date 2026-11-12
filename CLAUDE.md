# Memory

## Me
Elliott — building Backbone Hub, a full-stack hospitality management platform for restaurants.

## This Repo
Restaurant/hospitality management system — React + TypeScript + Firebase + Vite PWA, with Gemini AI integration.

→ Full details: memory/projects/Backbone-Hub.md

## Tech Stack
| Layer | Tech |
|-------|------|
| Frontend | React 18 + TypeScript + Tailwind v4 |
| Build | Vite + PWA (vite-plugin-pwa) |
| Backend | Firebase (Firestore, Auth, Storage) |
| AI | @google/genai (Gemini) |
| Charts | Recharts |
| PDF | jspdf + jspdf-autotable |
| CSV | papaparse |
| QR/Barcode | html5-qrcode + qrcode.react |
| Animation | Framer Motion / motion |
| Toast | sonner |
| Icons | lucide-react |
| Testing | Playwright |

## Key Components
| Component | Purpose |
|-----------|---------|
| `Dashboard.tsx` | Main app shell |
| `FinancialCommandCenter.tsx` | P&L, costs, financial overview |
| `InventoryList.tsx` | Stock management |
| `StockTaking.tsx` | Physical stock count |
| `WasteManager.tsx` | Waste recording |
| `LabourIntelligence.tsx` | Labour cost analysis |
| `ShiftBriefingManager.tsx` | Pre-shift briefings |
| `MenuRecipes.tsx` | Recipe & menu engineering |
| `Orders.tsx` | Order management / POS |
| `Reports.tsx` | Reporting |
| `VATReturnExport.tsx` | VAT export |
| `TrainingCenter.tsx` | Staff training + quiz bank |
| `ChatBot.tsx` | AI assistant |
| `BarcodeScanner.tsx` | Barcode scanning |

## Key Services
| Service | Purpose |
|---------|---------|
| `geminiService.ts` | Gemini AI calls |
| `aiDecisionService.ts` | AI-driven decisions |
| `pnlEngine.ts` | P&L calculation engine |
| `inventoryService.ts` | Inventory CRUD |
| `labourImportService.ts` | Rota/labour import parsing |
| `restaurantService.ts` | Core restaurant data |
| `performanceService.ts` | KPI/performance metrics |
| `pdfService.ts` | PDF generation |

## Key Files
| File | Purpose |
|------|---------|
| `firebase.ts` | Firebase client init |
| `types.ts` | All shared TypeScript types |
| `constants.ts` | App-wide constants |
| `App.tsx` | Root component + routing |
| `firestore.rules` | Security rules |
| `seed_runner.mjs` | Database seeding |

## Preferences
- Direct, practical answers
- Complete code when making changes
- Point out risks before acting
- Small business → scalable thinking
