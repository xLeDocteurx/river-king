# Repo branding: GitHub About + live site link

- **Date:** 2026-08-30
- **Status:** Draft
- **Linked issue:** #33

## Problem

The repo's GitHub **About** block was empty (no description, no homepage, no topics), so the
project was invisible and undiscoverable on GitHub. A **GitHub Pages** site is already deployed
and live at https://xledocteurx.github.io/river-king/ (auto-deployed on push to `main` via
`.github/workflows/deploy-pages.yml`), but the link was never surfaced anywhere.

## Solution

1. Fill the GitHub repo About: short punchy description, homepage pointing to the live Pages
   site, and a coherent set of discoverability topics.
2. Add a clickable "Live Demo" badge (plus a CI badge) at the top of the README that opens the
   live site.

## Design decisions (finalized 2026-08-30)

- **Scope:** repo About (description + homepage + topics) + "Live Demo" badge in the README.
  No in-app link (status bar unchanged).
- **Description tone:** short and punchy.
- **Topics:** discoverability-oriented (angular, typescript, pixel-art, tilemap, game-dev, indexdb).
- **Site already live:** no CI/pipeline change required.

## UI / UX details

- README badges use shields.io with the brand color `#005fb8` for the Live Demo badge.

## Data model changes

None.

## Testing

No unit tests (repo metadata + README). Verified the asset URLs return HTTP 200 and the About
fields are set.

## Out of scope

PWA manifest / installability, in-app branding links, other badge types.
