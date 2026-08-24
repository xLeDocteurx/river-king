# Deploying to GitHub Pages

The app is hosted at https://xledocteurx.github.io/river-king/ and deploys automatically
on every push to `main` via [.github/workflows/deploy-pages.yml](../.github/workflows/deploy-pages.yml).

## One-time setup (repository owner)

1. Open **Settings → Pages** on the GitHub repository.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.

Without this step the deploy job fails with a 404/permissions error.

## How it works

- The workflow builds with `--base-href /river-king/` so all asset URLs match the
  Pages sub-path.
- `index.html` is copied to `404.html`: GitHub Pages serves `404.html` for unknown
  routes, which gives Angular's client-side router a chance to handle deep links
  such as `/river-king/project/<id>/scenes`.
- Deployment is manual too: run the workflow from the **Actions** tab
  (`workflow_dispatch`).

## Local verification

```bash
npm run build -- --configuration production --base-href /river-king/
cp dist/river-king/browser/index.html dist/river-king/browser/404.html
npx http-server dist/river-king/browser   # or any static server
```

Check that `dist/river-king/browser/index.html` references scripts under `/river-king/`.

## Data persistence caveat

Projects are stored in the browser's **IndexedDB**, keyed by origin. Data created on
`localhost` will not appear on the Pages deployment (different origin), and data is
never synced between browsers or devices.
