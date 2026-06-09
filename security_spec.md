# Security Specification: Staffing & Rota Intelligence

## Data Invariants
1. A Staffing Forecast must belong to a location and have Valid Forecasted Sales (> 0).
2. A Rota must belong to a valid week starting date and follow the Draft -> Published lifecycle.
3. Rota Suggestions are immutable once generated.
4. Staff Availability can only be managed by the staff member themselves or a manager.
5. Labour Budget records can only be modified by Admins/Managers.

## The "Dirty Dozen" Payloads
1. **Unauthorized Rota Edit**: Attempting to edit a published rota as a Waiter.
2. **Identity Spoofing in Availability**: Waiter A trying to change Waiter B's availability.
3. **Budget Manipulation**: Unauthorized user trying to lower the labour budget target.
4. **Invalid Forecast ID**: Injecting junk characters into a forecast date ID.
5. **Shadow Update**: Adding a `bonusPayment: 10000` field to a Rota Shift doc.
6. **Self-Approval**: Staff member trying to approve their own holiday request.
7. **Negative Budget**: Setting `labourBudget: -100` in a forecast.
8. **Orphaned Rota**: Creating a rota for a location that doesn't exist.
9. **Terminal State Break**: Trying to edit a "Published" Rota back to "Draft" after audit.
10. **Resource Exhaustion**: Sending 500KB of "Reasoning" text in a Rota Suggestion.
11. **PII Leak**: Unauthorized user trying to read full `staffAvailability` list including notes.
12. **Future Poisoning**: Creating a rota for the year 2099 to gap the system.

## The Test Runner
`staffing_rota.test.ts` (conceptual) will be used to verify these constraints.
