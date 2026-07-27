# Next Up

- Achiote Paste's "Expected" quantity may still show a number that's off by its pack size (e.g. 0.15 instead of 15) in Stock Taking, separate from the NaN/crash bug that's now fixed — this is a pre-existing quirk (already flagged in a code comment) where items whose unit label is the same as their base unit (grams/ml) but also have a pack size set can get double-converted. Worth a proper fix if it turns out to affect real counts, not just Achiote.
- In the recipe editor, "is this a batch recipe" is checked two slightly different ways in two spots (one checks "not a menu item", the other checks "is a recipe"). They agree today because there are only two recipe types, but if a third type is ever added they could disagree. Worth using one consistent check if that ever changes.
- Sides and add-ons only become orderable items on the POS screen when someone clicks "Sync All to POS" in bulk — saving a single recipe with a new side/add-on does not push it to the POS ordering screen on its own. Worth wiring that into the normal per-recipe save if staff expect a new side to be orderable right after saving.
- If you start editing a saved side or add-on (click the pencil icon) and then hit "Save Recipe" without clicking "Update Side/Add-on" first, that in-progress edit is quietly discarded — everything else saves fine, just not the edit you were mid-way through. Worth a small warning or auto-save if this trips people up in practice.

## Done

- 30 inventory items with corrupted stock quantities (Totopos Tortilla Chips, Red Onion, Lamb Shank, Jalapeno Fresh, Beef Fillet, Corn Masa Flour Maseca, Chicken Breast, Flour Tortillas 12cm, Oaxaca Cheese, Duck Breast, Plain Flour, Corn Tortillas 12cm, Tomatoes Plum, Lard, Beef Mince Picadillo, Pinto Beans Dried, King Prawns, Courgette, Pork Shoulder, Chicken Thigh, White Onion, Seabass Fillet, Mayonnaise, Black Beans Dried, Fresh Lime Juice, Caster Sugar, Chihuahua Cheese, Octopus, Long Grain Rice, Button Mushrooms) — recovered and corrected 2026-07-27. See fix log.
- Stock Take completion screen's unit-conversion bug (the one that caused the 30-item corruption above) — fixed 2026-07-27. See fix log.
