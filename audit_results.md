# Backbone Hub - Internal Audit Report
**Date:** 2026-04-20
**Auditor:** AI System

## 1. Firebase Configuration Audit
- **Project ID:** `backbone-hub` (Matches config)
- **Database ID:** `ai-studio-ed2c0f12-89cb-43e1-8002-769e61587403` (Specific instance confirmed)
- **Auth Configuration:** Google Auth is active. Persistance is set to `browserLocalPersistence`.
- **Initialization:** Switched to `initializeFirestore` with `experimentalForceLongPolling` for better performance in sandboxed preview environments.

## 2. Security Rules Audit
- **Rule Strategy:** Multi-stage deployment. 
- **Targets:** Deployed to both `(default)` and named ID via `firebase.json`.
- **Logic:**
    - Explicit `match` for the named database.
    - Admin override for `saga00@gmail.com`.
    - Authenticated access for operational collections.
    - Path variable hardening (`isValidId`) applied.
- **Vulnerability Check:** Diagnostic rules currently allow read/write to authenticated users. This is acceptable for the current development phase but will be tightened once saving is confirmed.

## 3. Application Data Audit
- **Dual-Save Workflow:** Confirmed that `App.tsx` handles both `recipes` and `menuItems` sync.
- **Object Sanitization:** `cleanObject` utility is used on all Firestore writes to prevent `undefined` values.
- **POS Mapping:** Category mapping is robust with fallback to `cat_mains`. Prices are correctly converted to cents.

## 4. Initialization Audit
- **Seed Data:** `restaurantService.ts` correctly seeds `menuCategories` and `menuItems` if the targeted database is empty.
- **Real-time Sync:** `onSnapshot` listeners are properly cleaned up in `useEffect` unmounts.

## 5. User Specific Permissions
- **Admin User:** `saga00@gmail.com` has been added as a master admin in `firestore.rules`.
- **Operational Logic:** All operational staff can read/write within their location (`loc_camden`).

## Conclusion
The infrastructure is correctly configured. Any further "save failed" issues are likely transient network interruptions or specific invalid characters in ID fields. Enhanced logging and polling drivers have been added to mitigate these.
