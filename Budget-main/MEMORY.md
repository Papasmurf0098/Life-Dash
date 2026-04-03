# Project Memory

## Product Vision

Pocket Budget is a mobile-first personal budgeting app designed to be fast, local, and phone-friendly.

The product goal is:
- help the user see how much money is actually left to spend this month
- track real income earned, not just planned starting money
- track recurring monthly bills and required spend
- subtract expenses from category buckets immediately
- stay simple enough to run as a lightweight PWA on a phone

This is intentionally not a full banking app. It should remain focused on monthly budgeting, envelope-style category control, and quick entry.

## UX Direction

The UI should feel:
- calm
- premium
- mobile-first
- visually intentional, not generic SaaS

Current visual direction:
- turquoise glow as the main atmosphere
- forest green for primary actions and positive states
- dark brown for text depth, contrast, and grounding
- soft glassy surfaces and restrained motion
- animated decorative header graphic that suggests money flow / ledger tracking

Design rules to preserve:
- avoid dashboard-card spam
- avoid bright neon overload or harsh contrast
- keep strong typography hierarchy
- keep forms easy to use one-handed on a phone
- motion should support presence, not distract from budgeting tasks

## Technical Structure

Core app stack:
- React
- TypeScript
- Vite
- Framer Motion
- vite-plugin-pwa
- Vitest + Testing Library

Main file responsibilities:
- `src/App.tsx`: primary single-screen application UI and interaction flows
- `src/budget.ts`: core business logic, calculations, derived month snapshot, import/export parsing
- `src/types.ts`: persisted data model and derived snapshot types
- `src/storage.ts`: localStorage load/save and import helpers
- `src/constants.ts`: starter buckets, colors, storage key, data version
- `src/App.css` and `src/index.css`: visual system and layout
- `.github/workflows/deploy.yml`: GitHub Pages deployment via GitHub Actions

## Data Model

Primary persisted object: `BudgetData`

Important entities:
- `MonthPlan`: starting monthly amount, bucket allocations, manual rollovers
- `IncomeEntry`: actual earned money entries for a month
- `Expense`: manual or recurring-bill-generated spending entries
- `RecurringBill`: monthly required bill definition
- `RecurringBillMonthState`: paid/unpaid state for a bill in a specific month
- `Bucket`: editable spending category

Money rules:
- store all money as integer cents
- store dates as strings
- derived available balance is:
  - `startingAmountCents + totalIncomeCents - totalSpentCents`
- bucket remaining is:
  - `allocated + rollover - spent`

## Product Behavior

Key current behaviors:
- user can set a starting monthly amount
- user can add income entries and see actual total earned
- user can add expenses and update category totals immediately
- user can add recurring bills and mark them paid
- marking a recurring bill paid creates or syncs a matching expense entry
- user can create, rename, budget, roll over, archive, or delete buckets
- user can export/import budget data as JSON
- all data is local-only in browser storage

Scope boundaries to preserve unless explicitly changed:
- no bank sync
- no accounts system
- no backend
- no authentication
- no multi-user support
- no automatic rollover logic
- no complex recurrence beyond monthly bills

## Deployment Notes

Deployment target:
- GitHub Pages

Important deployment requirement:
- GitHub Pages must use `GitHub Actions` as the source
- do not use `Deploy from a branch`, because that serves raw source files instead of the built Vite output

Expected production URL:
- `https://papasmurf0098.github.io/Budget/`

Vite base path:
- derived from `GITHUB_REPOSITORY` in `vite.config.ts`

## Testing and Validation

Primary checks:
- `npm run lint`
- `npm run test:run`
- `npm run build`

Current expectation:
- any UI or logic change should keep all three passing

When changing visuals:
- keep the app building cleanly
- avoid breaking accessibility labels used by tests

When changing budgeting logic:
- update `src/budget.test.ts`
- update `src/App.test.tsx` if visible behavior changes

## Practical Notes For Future Work

- This repo was initialized locally and pushed to `main`
- The GitHub remote is `https://github.com/Papasmurf0098/Budget.git`
- The current first commit is the initial app baseline
- If the deployed site appears blank, first verify GitHub Pages is set to `GitHub Actions`
- Preserve the project’s single-screen mobile workflow unless there is a strong reason to introduce routing
