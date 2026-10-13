# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-10-14

### Added

- Tile anchor system with directional (4-way) footprints: tiles render and block across
  their full footprint, and anchors round-trip through project export/import (#92).
- Anchor tool in the sprite editor to set a tile's ground zone, with an Auto reset button
  and a status-bar readout (#93).

### Changed

- Adding a frame now promotes a tile from static to animated; resizing a tile clamps its
  stored anchor (#92).
- The demo tree is re-authored as a single 16x32 sprite overhanging the cell above; the demo
  project is seeded at bootstrap and the app root adopts OnPush with clearer error toasts
  (#90, #92).

### Fixed

- Static tiles are guaranteed to hold a single frame: `TileService` rejects static tiles
  with multiple frames, and the sprite editor asks for confirmation before dropping frames
  when switching to static (#92, #97).

## [0.1.0] - 2026-10-06

First versioned release. Everything shipped up to this tag is listed below, since no
earlier version was ever published.

### Added

**Projects**

- Dashboard with full project lifecycle: create, open, export, import, delete (#2).
- Project export/import as JSON, with sprite atlases (#2).
- Route guard validating the project before an editor loads it (#21).
- Responsive layouts for small screens (#23).
- Utility status bar showing cursor position, zoom level and layer/tile counts (#3).

**Scene editor**

- Layer-based scene editing with an active layer (#7).
- The map auto-grows when a tile is placed outside the current grid, scene and every layer
  grid included (#7).
- Grid visibility toggle (#5).
- Undo/redo across the scene, sprite and tile editors (#1).
- Keyboard shortcuts in the editors (#13).
- Folders in the scene list: inline creation (#18), rename by double-click (#16), deletion
  (#4), and smart folding for long lists (#17).

**Tile manager**

- Tile definitions carrying runtime properties: `blocking`, `interactable` and its
  `actionId` (#51, #52).
- Animation speed per tile, with a continuous animation loop in Play mode (#50).
- Y-sort ("overhanging") tile data and its authoring control (#53).

**Sprite editor**

- Frame management for animated tiles (#15).
- Pixel-canvas grid visibility toggle (#40).
- Onion-skin controls behind a floating button and popover (#41).

**Play mode**

- Play/Edit toggle with a player controller and camera follow (#49).
- Cell-level blocking collision, computed from layers, footprints and `blocking` (#51).
- Interactable tile actions (#52).

**Onboarding**

- First-run demo project seed: a "Demo" project with animated water, y-sort trees, a
  blocking boulder and an interactable sign (#70).

**Process and infrastructure**

- CI pipeline running lint, tests and build on every pull request (#25).
- Release pipeline: GitHub Pages deploys from the Actions workflow on `main` pushes, and a
  draft GitHub Release with auto-generated notes is created per `v*` tag (#73).
- Documented release runbook plus an agent-driven `release` skill (#73, #75).
- Status bar shows the engine version (`River King Engine — vX.Y.Z`) from `package.json`
  (#74).
- `develop` as the integration branch for merge requests (#64), with merged feature
  branches deleted automatically (#34).
- English-only GitHub-facing content (#35), repository branding and favicon (#24, #33),
  project README (#6), and removal of empty stub folders (#22).

### Fixed

- Deleting a project no longer leaves orphaned folder rows behind; the cascade now covers
  every table owned by the project (#69).
