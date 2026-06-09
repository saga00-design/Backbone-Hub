# Backbone Hub: Quality Assurance & Go-Live Documentation

This document contains comprehensive checklists and risk assessments to ensure the stability, accuracy, and operational readiness of the Backbone Hub platform.

---

## 1. Module-by-Module Test Checklist

### 🔐 Authentication & Security
- [ ] **Email Registration**: Verify account creation sends verification email.
- [ ] **Verification Wall**: Ensure unverified users cannot access the dashboard.
- [ ] **Google Sign-In**: Verify seamless login and account linking.
- [ ] **Logout**: Ensure all local states are cleared and session is terminated.
- [ ] **Role-Based Access**: Verify 'Manager' vs 'Staff' permissions (if applicable).

### 📊 Dashboard
- [ ] **Real-time Stats**: Verify "Total Inventory Value" matches sum of all items.
- [ ] **Low Stock Alerts**: Ensure items below `minStockLevel` appear correctly.
- [ ] **Recent Activity**: Verify stock movements and invoices show up in chronological order.
- [ ] **Quick Actions**: Test "Add to Cart" and "Process Invoice" shortcuts.

### 📦 Inventory Management
- [ ] **CRUD Operations**: Create, Read, Update, and Delete items.
- [ ] **Bulk Actions**: Test bulk delete and bulk category updates.
- [ ] **Search & Filter**: Verify filtering by Category, Department, and Supplier.
- [ ] **Unit Logic**: Ensure changing `unitSize` correctly recalculates base quantities.
- [ ] **Image Upload**: Verify placeholder logic and custom image rendering.

### 🍳 Menu & Recipes
- [ ] **Recipe Costing**: Verify total cost updates when ingredient quantities change.
- [ ] **GP Calculation**: Ensure GP % accurately reflects (Price - Cost) / Price.
- [ ] **Nested Batches**: Verify a "Prep" item used as an ingredient calculates cost recursively.
- [ ] **Yield Management**: Test "Produce Batch" button (deducts ingredients, adds to batch stock).
- [ ] **Allergen Detection**: Verify allergens are automatically pulled from ingredients.

### 🧾 Invoice Processing
- [ ] **AI Parsing**: Test various invoice formats for accuracy in vendor, date, and line items.
- [ ] **Manual Entry**: Verify manual fallback works when AI is disabled.
- [ ] **Approval Workflow**: Ensure stock is ONLY updated after clicking "Approve".
- [ ] **Duplicate Prevention**: Verify system warns if an invoice with the same ID/Vendor exists.

### 🛒 Stock Orders
- [ ] **Cart Logic**: Verify items added from different modules aggregate in the cart.
- [ ] **Supplier Splitting**: Ensure orders are grouped by supplier.
- [ ] **Order Status**: Track from 'Draft' -> 'Sent' -> 'Received'.
- [ ] **Receiving**: Verify "Mark as Received" updates inventory levels.

### 🖥️ Backbone POS
- [ ] **Menu Navigation**: Verify categories and items display correctly.
- [ ] **Order Entry**: Test adding items, modifiers, and notes.
- [ ] **Payment Flow**: Verify total calculation (Subtotal + VAT + Service Charge).
- [ ] **Inventory Sync**: Ensure "Finalize Sale" deducts ingredients from stock in real-time.

### 🗑️ Waste & Expenses
- [ ] **Waste Logging**: Verify reason codes and cost impact.
- [ ] **Expense Tracking**: Test category-based expense logging and image attachments.
- [ ] **Reporting**: Ensure waste/expenses are reflected in the P&L reports.

---

## 2. Button-by-Button Verification Checklist

### Global
- [ ] **Sidebar Toggle**: Opens/closes correctly on mobile.
- [ ] **Dark Mode Toggle**: Persists across views and saves to user profile.
- [ ] **Logout Button**: Redirects to login and clears `localStorage`.

### Inventory View
- [ ] **"Add Item"**: Opens modal with empty fields.
- [ ] **"Edit" (Pencil)**: Opens modal with pre-filled data.
- [ ] **"Delete" (Trash)**: Triggers confirmation modal.
- [ ] **"Add to Cart" (Plus)**: Increments cart count without page reload.

### Recipe View
- [ ] **"New Recipe"**: Opens builder with type selection (Recipe vs Menu Item).
- [ ] **"Produce Batch"**: Triggers ingredient deduction logic.
- [ ] **"Optimize Prices"**: Recalculates selling prices based on target GP.

### Invoice View
- [ ] **"Switch to Manual"**: Toggles between AI upload and manual form.
- [ ] **"Analyze with AI"**: Triggers Gemini API call and shows loading state.
- [ ] **"Approve" (Checkmark)**: Commits data to inventory and logs movement.

---

## 3. Formula Verification Checklist

| Calculation | Formula | Expected Result |
| :--- | :--- | :--- |
| **Gross Profit (GP)** | `((Selling Price - Cost) / Selling Price) * 100` | 75% GP for £10 price / £2.50 cost |
| **Base Quantity** | `Input Quantity * unitSize` | 5L * 1000ml = 5000ml |
| **Unit Cost** | `Total Invoice Price / (Quantity * unitSize)` | £50 / (10 * 500g) = £0.01 per gram |
| **Recipe Total Cost** | `Σ (Ingredient Base Qty * Item Price Per Base Unit)` | Sum of all parts including nested batches |
| **VAT Calculation** | `Net Price * (VAT Rate / 100)` | £100 * 0.20 = £20 VAT |
| **Stock Depletion** | `Current - (Sales Qty * Recipe Ingredient Qty)` | Accurate reduction of raw ingredients |

---

## 4. Top 20 High-Risk Scenarios

1.  **Concurrent Updates**: Two managers updating the same "Milk" stock at the same time.
2.  **Circular Recipes**: Recipe A uses Recipe B, and Recipe B uses Recipe A (Infinite Loop).
3.  **Zero Price Items**: Invoices with £0 items causing "Division by Zero" in GP formulas.
4.  **Unit Mismatch**: Buying in "Cases" but recipes using "Grams" without a defined `unitSize`.
5.  **Deleted Ingredients**: Deleting "Flour" while it's still linked to 50 active recipes.
6.  **Massive Invoices**: Uploading a 200-item invoice (Memory/API limits).
7.  **Network Drop**: Internet fails halfway through a POS transaction.
8.  **Storage Full**: Browser `localStorage` hits 5MB limit (handled by Error Boundary).
9.  **Invalid Date**: Manually entering an invoice date in the future.
10. **Duplicate Suppliers**: Creating "GrainMaster" and "Grain Master Ltd" causing fragmented data.
11. **Yield Variance**: Producing a 10L batch that only yields 9L in reality.
12. **Price Spikes**: A supplier doubles the price of "Oil", making 20 recipes unprofitable instantly.
13. **Unauthorized Access**: A staff member guessing the URL for the 'Settings' or 'Cloud' tab.
14. **Negative Stock**: Selling more items than are in inventory (Allow vs. Block logic).
15. **Rounding Errors**: Accumulating 0.0001p errors over 10,000 transactions.
16. **Image Bloat**: High-res 10MB photos in recipes slowing down the mobile app.
17. **Allergen Omission**: Adding an ingredient with "Nuts" but forgetting to tag the recipe.
18. **VAT Changes**: Government changing VAT from 20% to 15% (Global vs. Local update).
19. **Bulk Delete Accident**: Selecting "All" in inventory and clicking delete without reading.
20. **Firebase Quota**: Hitting the free tier limit for Firestore reads/writes during a busy shift.

---

## 5. Pre-Launch Go-Live Checklist

### 🛠️ Technical Setup
- [ ] **Firebase Rules**: Deploy `firestore.rules` with strict `isOwner()` checks.
- [ ] **API Keys**: Ensure `GEMINI_API_KEY` is set in the production environment.
- [ ] **Metadata**: Update `metadata.json` with final app name and description.
- [ ] **Permissions**: Ensure `camera` and `geolocation` permissions are requested if needed.

### 📊 Data Integrity
- [ ] **Clean Slate**: Wipe all mock/test data from the production database.
- [ ] **Unit Standardization**: Ensure all base units are consistent (ml, g, pcs).
- [ ] **Supplier Onboarding**: Import real supplier contact details.

### 🎨 UX & Branding
- [ ] **Favicon/Logos**: Verify `Backbonehub-ico.png` is loading correctly.
- [ ] **Typography**: Check font consistency across all modules.
- [ ] **Mobile Audit**: Test POS flow on a tablet and a smartphone.

### 🛡️ Operational Readiness
- [ ] **Backup Plan**: Verify the "Export Data" button works for emergency backups.
- [ ] **Staff Training**: Create a 1-page "Cheat Sheet" for the POS and Waste modules.
- [ ] **Error Handling**: Verify the Error Boundary shows a user-friendly message, not code.
