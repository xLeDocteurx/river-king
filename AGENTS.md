# AGENTS.md

> Concise repo-specific guide for OpenCode sessions working in this Angular codebase.
> If it is obvious from file names, it is not here.

---

## Stack & versions

- Angular 22 (standalone components, no NgModule)
- TypeScript ~6.0
- Tailwind CSS v3 with `prefix: 'tw-'`
- SCSS for styles
- Unit tests via `@angular/build:unit-test` (Vitest + jsdom), no Karma/Jasmine
- ESLint 9 + `@angular-eslint` + `typescript-eslint` (flat config)
- Prettier 3 with Angular HTML parser
- Package manager: `npm`

---

## Development Environment (Devbox)

This repository uses [Devbox](https://www.jetify.com/devbox) (via Nix) to provide a reproducible, isolated Node.js environment. No manual Node.js installation is required.

| Command                     | Purpose                                                  |
| --------------------------- | -------------------------------------------------------- |
| `devbox shell`              | Enter an interactive shell with Node.js + npm pre-loaded |
| `devbox run npm run start`  | Run the dev server inside the Devbox environment         |
| `devbox run npm run build`  | Production build inside the Devbox environment           |
| `devbox run npm run test`   | Run tests inside the Devbox environment                  |
| `devbox run npm run lint`   | Run ESLint inside the Devbox environment                 |
| `devbox run npm run format` | Run Prettier and format all files inside the Devbox env  |

Devbox configuration lives in `devbox.json`. The environment pins **Node.js 22.x** and automatically runs `node -v` and `npm -v` on shell entry.

---

## Commands

| Command                                            | Purpose                                                    |
| -------------------------------------------------- | ---------------------------------------------------------- |
| `npm run start`                                    | Dev server (`ng serve`)                                    |
| `npm run build`                                    | Production build                                           |
| `npm run build` with `--configuration development` | Debug build with source maps                               |
| `npm run test`                                     | Run all Vitest suites headlessly (`ng test --watch=false`) |
| `npm run lint`                                     | Run ESLint on `src/**/*.ts` and `src/**/*.html`            |
| `npm run format`                                   | Run Prettier `--write` on the entire repo                  |
| `npm run format:check`                             | Run Prettier `--check` (CI-friendly)                       |
| `./node_modules/.bin/ng.js`                        | If `ng` is missing in PATH, invoke the local CLI directly  |

**Note:** Do not install new unit-test runners. Angular Builder handles Vitest config internally; there is no `vitest.config.ts` in the repo.

---

## Component selector prefix

- The `angular.json` prefix is **`rk`** (River King).
- CLI-generated components become `rk-button`, `rk-dialog`, etc.
- The root app component is `rk-root`.

---

## Folder architecture

```
src/app/
├── core/          # Singletons, root-provided services, guards, interceptors
│   ├── services/     # DatabaseService, ThemeService, NotificationService, SessionService
│   └── Never import core/* into shared/ or features/*
├── shared/        # Reusable UI, models, pipes, directives (NO services here)
│   ├── components/   # Headless/stateless UI (rk-dialog, rk-confirm-dialog, rk-toast)
│   ├── models/       # Pure TS interfaces/types (Project, Scene, Tile, Sprite, Session)
│   ├── directives/
│   └── pipes/
└── features/      # Lazy-loaded business features (flat structure)
    ├── dashboard/
    │   ├── *.component.{ts,html,scss,spec.ts}
    │   ├── *.service.{ts,spec.ts}
    │   └── *.routes.ts
    ├── project/
    ├── scene-editor/
    ├── tile-manager/
    └── sprite-editor/
```

**Rules:**

- `core/` must stay independent; it is not allowed to import from `shared/` or `features/`.
- `features/` should expose lazy-loaded routes and keep internal files private. Flat structure: no `pages/` or `components/` sub-folders inside a feature.
- `shared/` is for code that is truly reusable across features. Services belong in `core/services/`, not `shared/services/`.
- Every folder above contains a `README.md` describing its purpose.

---

## Styling rules

### Tailwind CSS

- **Prefix required:** `tw-`. Example: `tw-bg-background`, `tw-text-foreground`, `tw-border tw-border-border`.
- Tailwind config lives at `tailwind.config.js`. Extended theme colors map to CSS custom properties from `src/styles/theme.scss`.
- `darkMode: 'class'` is set; dark mode is toggled by adding/removing the `.dark` class on `<html>`.

### Theme system

- Design tokens are CSS custom properties in `src/styles/theme.scss` (background, foreground, primary, secondary, accent, destructive, muted, border, input).
- Light tokens live in `:root`; dark tokens live in `.dark, [data-theme="dark"]`.
- `ThemeService` (`core/services/theme.service.ts`) owns the reactive theme state via `writableSignal`. It reads/writes `localStorage` key `rk-theme` and toggles the `.dark` class on `<html>`.
- To use a theme-aware color: reference the Tailwind extended color name (e.g., `tw-bg-primary`, `tw-text-foreground`), not the raw hex value.

### Icons

- Use **Material Symbols** (`@material-symbols/font-400`), not legacy Material Icons.
- Webfont is loaded via `@font-face` in `theme.scss` (variable font, `font-weight: 100 700`).
- Render an icon with `<span class="material-symbols" aria-hidden="true">light_mode</span>`.
- Because Material Symbols is a font, it composes naturally with Tailwind utility classes (size, color).

---

## Angular conventions

- **Standalone components only.** No `NgModule`. Use `imports: [...]` in `@Component()`.
- **Change detection:** Prefer `ChangeDetectionStrategy.OnPush`. Required for shared components.
- **Signals preferred:** Use `input()`, `output()`, `model()`, `viewChild()`, `effect` instead of RxJS `Subject`/BehaviorSubject for local/component state.
- **Reactive forms preferred:** Use Angular Signals–based reactive forms (`FormBuilder` + signals) when inputs and validation are required.
- **Headless components (shared):** Shared UI components should not bake in visual styles. Accept a `class` input to let consumers apply Tailwind utilities.
- **Global state:** Keep global reactive state in `core/services/` and expose it via signals. Never expose raw RxJS Observables to components when a signal will do.
- **Error handling:** Application-level errors must be shown to the user via `NotificationService` (toast notifications, 5s auto-dismiss, dismissible). Wrap async IndexedDB operations in `try/catch` and call `notification.error(message)`.
- **Dialogs:** Always use the native HTML `<dialog>` element via `DialogComponent` (`src/app/shared/components/dialog/`). It provides built-in focus trap, Escape handling, and backdrop styling via `::backdrop`. Never build custom modal overlays with z-indexed `<div>` containers.

---

## Documentation & JSDoc

- **Every public method** must have a JSDoc block with `@param`, `@returns`, and `@throws` where applicable.
- **Every component class** must have a class-level JSDoc explaining its responsibility.
- **Every service class** must have a class-level JSDoc.
- **All models/interfaces** must document every property.
- These comments are intended to generate TSDoc / JSDoc output one day. Write them clearly and precisely.

---

## Component templates

- **Never inline templates.** Every component must have a separate `*.component.html` and `*.component.scss` file.
- Reference them with `templateUrl` and `styleUrl` in the `@Component` decorator.
- This keeps TypeScript logic readable and enables better tooling (template type-checking, Prettier formatting, IDE navigation).

---

## Testing

- Run via `npm run test` (Vitest under the hood). Uses jsdom; no real browser.
- Tests are `*.spec.ts` alongside the code under test.
- `tsconfig.spec.json` includes `types: ["vitest/globals"]`.
- Use `TestBed.configureTestingModule({ imports: [ComponentUnderTest] })` for standalone component setup.
- If a component test fails with unknown errors, confirm `index.html` has `<rk-root></rk-root>` and that `app.ts` has `selector: 'rk-root'`.

---

## Build constraints

- Initial bundle budget: 500KB warning, 1MB error.
- Per-component style budget: 4KB warning, 8KB error.
- Keep styles in SCSS files imported through `styles.scss`; do not generate large inline styles in components.

---

## Quick reference (copy-paste)

**Create a shared component:**

```bash
ng generate component shared/components/button --prefix rk
```

(Outputs `rk-button` with selector `rk-button`, SCSS, standalone, OnPush by default.)

**Toggle dark mode programmatically:**

```ts
const theme = inject(ThemeService);
theme.toggle();
```

**Use a theme token in a component:**

```html
<div class="tw-bg-background tw-text-foreground tw-border tw-border-border"></div>
```

**Use a Material Symbol icon:**

```html
<span class="material-symbols" aria-hidden="true">home</span>
```

**Show a toast notification:**

```ts
const notification = inject(NotificationService);
notification.error('Failed to save');
notification.success('Saved successfully');
```

**Open a native dialog (confirmation):**

```ts
const confirmDialog = viewChild.required(ConfirmDialogComponent);
// In template: <rk-confirm-dialog #confirmDialog [data]="..." (confirmed)="..." />
confirmDialog().open(); // Uses native <dialog> element under the hood
```

---

## Git workflow

- **Main branch:** `main`
- **Feature branches:** `feature-<ticket_number>` (e.g., `feature-42`)
- **Commit messages:** prefix with the branch name, e.g. `feature-42: add login form`
- The initial project setup commit (this repo's first commit) has **no prefix**.

---

## Gotchas

- Do not change `styles.ts` to something else; `src/styles.scss` is the single SCSS entry point referenced in `angular.json`.
- `@angular/build:unit-test` does **not** read a custom `vitest.config.ts`. If test behavior needs changing, check `angular.json` test options or `tsconfig.spec.json`.
- Because Tailwind prefix is `tw-`, standard Tailwind classes like `bg-red-500` will **not** work. Always write `tw-bg-red-500`.
- `core/` must stay independent; it is not allowed to import from `shared/` or `features/`.
- `features/` should expose lazy-loaded routes (e.g., `loadChildren`) and keep internal services/components private to the feature.
- **All singleton services** (DatabaseService, ThemeService, NotificationService, SessionService) must live in `core/services/`, never in `shared/services/`.
- **Never inline templates** in `@Component({ template: \`...\` })`. Always use `templateUrl`and`styleUrl` pointing to separate files.
