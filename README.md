# River King Engine

[![Live Demo](https://img.shields.io/badge/Live_Demo-005fb8?style=for-the-badge&logo=github&logoColor=white)](https://xledocteurx.github.io/river-king/) [![CI](https://img.shields.io/github/actions/workflow/status/xLeDocteurx/river-king/ci.yml?style=for-the-badge&label=CI)](https://github.com/xLeDocteurx/river-king/actions)

> A lightweight, browser-based tile engine for crafting 2D worlds — built with Angular 22 and saved entirely in your browser via IndexedDB.

[River King](https://github.com/xLeDocteurx/river-king) is a **pixel-perfect tile editor and scene composer** that runs without a backend. Every sprite, tile, scene, and layer is stored locally in your browser using IndexedDB, so your work travels with you and never hits a server.

Whether you're sketching mock-ups, building a retro RPG overworld, or prototyping a platformer, River King gives you the tools to draw sprites, assemble tiles, compose layered scenes, and iterate fast — all in one tab.

---

## Features

### 🎨 Sprite Editor

- Draw pixel-art sprites with a custom palette per project
- Pen, eraser, and flood-fill tools
- Frame-by-frame animation strip with drag-to-reorder
- Live animated preview with configurable FPS
- Undo/redo support

### 🧱 Tile Builder

- Link multiple sprite frames to a single tile
- Define tile size in tile-units (e.g., 2×3)
- Toggle between **static** and **animated** tile types
- Frame lifecycle management: create, duplicate, delete, resize
- Auto-resize frames when tile dimensions change

### 🗺️ Scene Composer

- Multi-layered scene editing with per-layer visibility and opacity
- Paint tiles onto scenes with footprint-aware placement
- Pan and zoom the canvas with mouse-wheel zoom-to-pointer
- Animated tiles play in real time on the canvas
- Scene grouping into folders
- Minimap for quick navigation

### 🏗️ Project Management

- Browser-local storage via IndexedDB — no backend required
- Projects, scenes, tiles, and sprites are all persisted
- Session restoration: reopen the last edited screen on reload
- Devbox-ready environment for reproducible development

---

## Tech Stack

| Layer       | Technology                                         |
| ----------- | -------------------------------------------------- |
| Framework   | Angular 22 (standalone components, no NgModule)    |
| Language    | TypeScript ~6.0                                    |
| Styling     | Tailwind CSS v3 with `tw-` prefix                  |
| State       | Angular Signals (`signal`, `computed`, `effect`)   |
| Storage     | IndexedDB via Dexie                                |
| Testing     | Vitest + jsdom via `@angular/build:unit-test`      |
| Linting     | ESLint 9 + `@angular-eslint` + `typescript-eslint` |
| Formatting  | Prettier 3 with Angular HTML parser                |
| Environment | Devbox (Nix-based, Node 22.x)                      |

---

## Getting Started

### Prerequisites

This repo uses [Devbox](https://www.jetify.com/devbox) to provide a reproducible Node.js environment. No manual Node.js installation is required.

```bash
# Enter the Devbox shell
devbox shell

# Or run commands directly through Devbox
devbox run npm install
devbox run npm run start
```

### Development Commands

| Command                | Purpose                           |
| ---------------------- | --------------------------------- |
| `npm run start`        | Start the dev server (`ng serve`) |
| `npm run build`        | Production build                  |
| `npm run test`         | Run all tests headlessly (Vitest) |
| `npm run lint`         | Run ESLint on TS and HTML         |
| `npm run format`       | Format everything with Prettier   |
| `npm run format:check` | Dry-run formatting check (CI)     |

> **Note:** On WSL or environments where bare `npm` resolves to Windows binaries over UNC paths, always use `devbox run ...`.

---

## Architecture Overview

```
src/app/
├── core/          # Singleton services: DatabaseService, ThemeService, SessionService, UndoService
├── shared/        # Reusable UI components: dialog, toast, searchable-select, confirm dialogs
└── features/      # Lazy-loaded business features
    ├── dashboard/       # Project list and creation
    ├── project/         # Project workspace shell + sidebar (Scenes / Tiles / Sprites)
    ├── scene-editor/    # Scene painter, minimap, layers, tile palette
    ├── sprite-editor/   # Pixel canvas, frame strip, palette manager, drawing tools
    └── tile-manager/    # Tile properties, frame lifecycle, resize, sprite linking
```

**Key design rules:**

- `core/` never imports from `shared/` or `features/`
- `features/` expose lazy-loaded routes and keep internals private
- Components follow the "services over outputs" rule: application-level actions go through injected services, not chained `@Output()` emissions
- Standalone components only — no `NgModule`
- Signals preferred over RxJS `Subject` for local state
- Tailwind CSS with `tw-` prefix; theme tokens via CSS custom properties

For more details, see [`AGENTS.md`](AGENTS.md).

---

## Contributing

We welcome contributions, whether it's a bug fix, a new feature, or improved documentation.

1. **Fork** this repository
2. **Create** a feature branch: `git checkout -b feature-42-short-name`
3. **Commit** with a prefixed message: `feature-42: add frame strip drag preview`
4. **Open** a Pull Request against `main`

Before submitting, make sure your changes pass lint and tests:

```bash
npm run lint
npm run test
```

Please review our [`AGENTS.md`](AGENTS.md) for coding conventions, component architecture, and design-system rules.

---

## License

MIT © River King Contributors

---

Built with ❤️ for pixel artists and world builders everywhere.
