# Backbone Hub: Comprehensive Fix & Mitigation Plan

This plan addresses the high-risk scenarios and potential data integrity gaps identified during the system audit.

---

## 1. Circular Recipe Dependencies
*   **Problem**: A recipe or prep batch could accidentally include itself or a parent recipe as an ingredient, causing an infinite loop during cost calculation and crashing the browser.
*   **Root Cause**: Lack of recursion depth checking or dependency graph validation in `calculateTotalCost`.
*   **Affected Modules**: `Menu & Recipes`, `POS (Ingredient Deduction)`, `Reports`.
*   **Exact Fix Recommendation**: Implement a "Dependency Tracker" in `recipeUtils.ts` that passes an array of `visitedIds` through the recursive calls. If an ID is encountered twice, throw a clear error.
*   **Validation Rule Needed**: `if (visitedIds.includes(ingredientId)) throw new Error("Circular dependency detected");`
*   **Priority Level**: **CRITICAL**
*   **How to Retest**: Create "Prep A" using "Prep B", then edit "Prep B" to include "Prep A". The system should block the save and show an alert.

---

## 2. Zero Price / Missing Cost GP Errors
*   **Problem**: Invoices with £0 items or missing inventory prices cause "NaN" or "Infinity" in Gross Profit displays.
*   **Root Cause**: Division by zero in the formula `(Price - Cost) / Price`.
*   **Affected Modules**: `Dashboard`, `Menu & Recipes`, `Reports`.
*   **Exact Fix Recommendation**: Update the GP utility function to return `0` if `sellingPrice <= 0`.
*   **Validation Rule Needed**: `const gp = sellingPrice > 0 ? ((sellingPrice - cost) / sellingPrice) * 100 : 0;`
*   **Priority Level**: **HIGH**
*   **How to Retest**: Set a menu item price to £0.00. Verify the GP % shows "0%" instead of "NaN%".

---

## 3. Orphaned Ingredients (Deletion Propagation)
*   **Problem**: Deleting an ingredient from inventory leaves recipes "broken" with missing data.
*   **Root Cause**: No referential integrity check before deleting an `InventoryItem`.
*   **Affected Modules**: `Inventory Management`, `Menu & Recipes`.
*   **Exact Fix Recommendation**: Before executing `handleDelete`, scan the `recipes` array for any ingredient matching the item ID. If found, show a list of affected recipes and require confirmation or block deletion.
*   **Validation Rule Needed**: `const isUsed = recipes.some(r => r.ingredients.some(i => i.inventoryItemId === targetId));`
*   **Priority Level**: **HIGH**
*   **How to Retest**: Try to delete "Flour". If it's in "Pizza Dough", the system should say: "Cannot delete. Used in: Pizza Dough".

---

## 4. Concurrent Stock Update Race Conditions
*   **Problem**: If two users approve invoices or finalize sales simultaneously, one update might overwrite the other.
*   **Root Cause**: Using `updateDoc` with local state values instead of Firestore `increment()` or Transactions.
*   **Affected Modules**: `Invoice Processing`, `POS`, `Waste Manager`.
*   **Exact Fix Recommendation**: Replace manual arithmetic (e.g., `quantity: existingItem.quantity + newQty`) with Firestore's `increment` operator.
*   **Validation Rule Needed**: `updateDoc(docRef, { quantity: increment(quantityChange) });`
*   **Priority Level**: **MEDIUM**
*   **How to Retest**: Open the app in two tabs. Approve an invoice for 10 units in Tab A and 5 units in Tab B. Verify the final stock is +15, not just the last one clicked.

---

## 5. Floating Point Precision (The "0.0001p" Error)
*   **Problem**: Cumulative rounding errors in ingredient costs (e.g., 0.00333g of Saffron) lead to inaccurate total inventory values.
*   **Root Cause**: JavaScript's native handling of floating-point numbers.
*   **Affected Modules**: `Inventory`, `Recipes`, `Stock Count`.
*   **Exact Fix Recommendation**: Perform all internal calculations using 6 decimal places, but round to 2 or 4 for UI display. Use a `roundTo` helper consistently.
*   **Validation Rule Needed**: `Math.round((num + Number.EPSILON) * 10000) / 10000;` (for 4 decimals).
*   **Priority Level**: **MEDIUM**
*   **How to Retest**: Add 10 items with a cost of £0.0033. Verify the total cost is £0.0330, not £0.03299999999.

---

## 6. Massive Invoice Payload Limits
*   **Problem**: Uploading a 500-item invoice might exceed Gemini API token limits or cause the browser to hang during processing.
*   **Root Cause**: Single-pass processing of large images/data sets.
*   **Affected Modules**: `Invoice Processing`.
*   **Exact Fix Recommendation**: Implement a client-side check on the number of items extracted. If > 100 items, warn the user. Optimize the prompt in `geminiService.ts` to be more token-efficient.
*   **Validation Rule Needed**: `if (parsedItems.length > 150) toast.warning("Large invoice detected. Please verify totals carefully.");`
*   **Priority Level**: **LOW**
*   **How to Retest**: Upload a multi-page PDF/Image invoice. Verify the UI remains responsive and shows a progress indicator.

---

## 7. Negative Stock Logic
*   **Problem**: POS sales can drive stock into negative numbers if the physical stock wasn't updated.
*   **Root Cause**: No "Floor" logic in the deduction functions.
*   **Affected Modules**: `POS`, `Inventory`.
*   **Exact Fix Recommendation**: Add a toggle in Settings: "Allow Negative Stock". If OFF, block POS sales for out-of-stock items. If ON, allow negative but highlight in RED.
*   **Validation Rule Needed**: `quantity: Math.max(allowNegative ? -999999 : 0, current - deduction)`
*   **Priority Level**: **MEDIUM**
*   **How to Retest**: Try to sell a "Steak" when inventory is 0. Verify the system either blocks it or shows -1 in red based on the setting.

---

## 8. Image Storage & Performance Bloat
*   **Problem**: High-resolution recipe photos (5MB+) slow down the "Menu Recipes" list and hit Firebase storage quotas.
*   **Root Cause**: No client-side image compression before upload.
*   **Affected Modules**: `Menu & Recipes`, `Inventory`.
*   **Exact Fix Recommendation**: Use `canvas` to resize images to a max width of 1200px and convert to WebP/JPEG (0.8 quality) before sending to the cloud.
*   **Validation Rule Needed**: `maxWidth: 1200, quality: 0.8`.
*   **Priority Level**: **LOW**
*   **How to Retest**: Upload a 10MB 4K photo. Check the network tab to ensure the uploaded payload is < 500KB.

---

## 9. Unauthorized Settings Access
*   **Problem**: Staff members could potentially access the 'Team' or 'Cloud' settings by manipulating the `currentView` state.
*   **Root Cause**: UI-only protection without server-side role validation.
*   **Affected Modules**: `Settings`, `App Navigation`.
*   **Exact Fix Recommendation**: Implement a `useRole` hook. Wrap sensitive components in a `RoleGuard`.
*   **Validation Rule Needed**: `{userRole === 'Admin' ? <Settings /> : <AccessDenied />}`
*   **Priority Level**: **HIGH**
*   **How to Retest**: Log in as a 'Staff' user. Verify the "Settings" icon is hidden and the URL/State cannot be forced to show Admin panels.

---

## 10. Unit Conversion Mismatch
*   **Problem**: Buying in "Boxes" but recipes using "Grams" without a `unitSize` defined (e.g., how many grams in a box?).
*   **Root Cause**: `unitSize` defaulting to 1 when it should be mandatory for certain conversions.
*   **Affected Modules**: `Invoices`, `Recipes`.
*   **Exact Fix Recommendation**: If the invoice unit differs from the base unit, force the user to define the `unitSize` in the manual entry or approval screen.
*   **Validation Rule Needed**: `if (unit !== baseUnit && !unitSize) throw new Error("Unit size required for conversion");`
*   **Priority Level**: **HIGH**
*   **How to Retest**: Add an item "Sugar" (Base: g). Process an invoice for "5 Bags". The system should prompt: "How many grams are in 1 Bag?".
