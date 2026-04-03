# Pocket Budget

Pocket Budget is a mobile-first PWA for staying current on how much you have left to spend each month. It keeps a live running total, tracks actual income earned, handles recurring monthly bills, and subtracts each expense from the matching bucket budget as soon as you log it.

## Features

- Running monthly balance from a user-set starting amount
- Actual income tracking with a monthly earned total
- Editable budget buckets with per-month allocations and manual rollovers
- Recurring monthly bills with paid or unpaid status
- Automatic recurring-bill expense creation when you mark a bill paid
- JSON export and import for local backup and restore
- Installable PWA that works well from a phone home screen

## Local development

```bash
npm install
npm run dev
```

Other useful commands:

```bash
npm run test:run
npm run build
npm run preview
```

## GitHub Pages deploy

1. Create a GitHub repository for this folder.
2. Push the code to your default branch.
3. In GitHub, open `Settings` -> `Pages`.
4. Ensure the site is configured to deploy from GitHub Actions.
5. The included workflow at `.github/workflows/deploy.yml` will build and publish the app.

The Vite base path is set automatically from `GITHUB_REPOSITORY` during GitHub Actions builds, so the app works when hosted at `https://<username>.github.io/<repo-name>/`.

If the root Pages URL shows a blank or white screen, the repository is being served directly instead of the built Vite output. The canonical fix is still `Settings -> Pages -> Source -> GitHub Actions`. This repo also includes a committed `/app/` fallback build, and the root `index.html` redirects there when the site is served from a GitHub Pages branch.

## Phone install

- iPhone: open the deployed site in Safari, tap Share, then `Add to Home Screen`
- Android: open the deployed site in Chrome, then choose `Install app` or `Add to Home screen`

## Data storage

Budget data is stored in `localStorage` on the current browser. Use export and import if you want a backup or need to move the budget to another device.
