# Aarav Traders – Load Accounts

## Phases

1. Build a visual sampler with Home and New Load previews in Clean Ledger, Dark Industrial, and Khata Cards. Let the user choose before implementing the full product.
2. After selection, build the chosen mobile-first app with the requested accounting, payments, parties, reports, settings, invite-only access, and shared updates.
3. Add database-backed calculations, access rules, audit history, and the requested sample loads; cover the two provided calculation cases with tests.
4. Add offline draft/write recovery and installable PWA support, then verify the main flows and responsive layout.

## Technical details

- Keep financial totals authoritative in PostgreSQL views and triggers; use typed client utilities for display and calculation tests.
- Use Supabase Auth with email magic links and Google, identifying partners by their invited email only.
- Use the existing TanStack Start and Supabase patterns; apply schema changes through the migration tool.
