# Life Dash

Life Dash is a private, local-first personal command center for priorities, projected shift earnings, and take-home budgeting. It is a single React + TypeScript progressive web app designed for desktop and mobile.

## Modules

- **Overview** surfaces the most useful signals from every module without mixing their accounting.
- **Bulletin** captures prioritized notes, tasks, due dates, and completed items.
- **Shift Tracker** records service shifts and compares section performance.
- **Take-home Budget** plans expenses and tracks only money that actually reached you.
- **Backup & restore** exports or restores all three modules in one versioned JSON file.

## Shift earnings model

Shift Tracker calculates a pre-tax projection for each shift:

```text
projected earnings = tips + (hours worked x $12.00)
                     - (optional food sales x 2%)
                     - (optional liquor sales x 8%)
```

The hourly base is derived automatically. Food and liquor sales are optional and used only to estimate tip-out. Projected earnings never post to Budget; take-home pay must be recorded deliberately in the Budget module.

## Local development

Requires Node.js 22 or newer.

```bash
npm ci
npm run dev
```

Quality checks:

```bash
npm run lint
npm run test:run
npm run build
```

## Data and privacy

Life Dash stores data in the browser's `localStorage`. It preserves the original storage keys so data from the earlier standalone modules continues to load. Data does not leave the device unless a backup file is downloaded and moved by the user.

Because browser storage can be cleared, download a full backup periodically from **Backup & restore**.

## Deployment

The GitHub Actions workflow validates pull requests and deploys the built `dist` directory to GitHub Pages on pushes to `main`. Vite automatically uses the repository subpath in GitHub Actions and `/` during local development.
