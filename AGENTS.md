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
├── shared/        # Reusable UI, models (NO services here)
│   ├── components/   # Headless/stateless UI (rk-dialog, rk-confirm-dialog, rk-toast)
│   ├── models/       # Pure TS interfaces/types (Project, Scene, Tile, Sprite, Session)
└── features/      # Lazy-loaded business features
    ├── dashboard/
    │   ├── *.component.{ts,html,scss,spec.ts}
    │   ├── *.service.{ts,spec.ts}
    │   └── *.routes.ts
    ├── project/
    ├── scene-editor/
    ├── sprite-editor/
    │   ├── canvas/ | palette/ | tools/   # one subfolder per child component
    │   ├── services/
    │   └── *.routes.ts
    └── tile-manager/
        ├── list/ | properties/           # one subfolder per child component
        ├── services/
        └── *.routes.ts
```

**Rules:**

- `core/` must stay independent; it is not allowed to import from `shared/` or `features/`.
- `features/` should expose lazy-loaded routes and keep internal files private. Features organize children into subfolders that mirror their component hierarchy (e.g. `canvas/`, `palette/`, `tools/`, `list/`, `properties/`): each subfolder holds one component's `.ts`, `.html`, `.scss`, and `.spec.ts`. The feature root keeps the routes file, the shell component, and the feature's services. Small features (a single component) may stay flat.
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

### Design system (mandatory)

Full reference: `docs/design-system/` — read `foundations.md` plus the relevant pattern file
before building any UI. Run through `docs/design-system/checklist.md` before delivering any
UI work.

- Colors: token-bound classes only (`tw-bg-background`, `tw-accent`, …). Never hardcode
  hex/rgb/hsl or raw Tailwind palette classes. `primary` = the main action, `accent` =
  highlight/hover/focus, `destructive` = deletion/error only.
- Density: root is 14px (global); UI text `tw-text-xs`; meta text `tw-text-[11px]`;
  section labels 12px uppercase tracking-wider.
- Shape: max radius `tw-rounded-sm`. No blurred shadows, no pills, no gradients.
- Icons: Material Symbols only.
- Layout: topbar 35px (root-owned) → scrollable content → status bar 22px app-wide
  (`bg-primary`, 11px; left = contextual info, right = `River King Engine`).
- Interactions: visible hover + `tw-cursor-pointer` on interactive surfaces; keyboard
  operability (`tabindex="0"` + Enter/Space on custom surfaces); never remove the global
  focus ring.
- Destructive actions go through `rk-confirm-dialog`; async failures call
  `NotificationService.error()`.
- UI copy: English only — absolute.

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

## Component architecture: services over outputs

- **A component's TS code serves its UI needs only:** rendering state, view helpers, local interaction handling. Anything application-level (navigation, persistence, business rules, shared state changes) belongs in an injected service.
- **Minimize outputs.** Never chain child → parent emissions to make the parent perform app actions (child emits `changed`, parent reloads data and navigates). Inject the relevant service in the component that owns the action and call it directly.
- **Inputs carry display data only:** models, primitives, flags. No callbacks, no app-workflow triggers through the template.
- Feature-specific services live in `features/<feature>/services/` and are provided by the feature's root component; cross-feature or global services live in `core/services/`.
- Reference implementations: `TileManagerComponent` (loads sprites/palette/tile size via `TileSpritesService` + `ProjectService`, navigates via `Router`), `MapTilesService` (supplies real tile images to `MapCanvasComponent`).

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
- Async DB work (Dexie/Promises inside event handlers) is **not** tracked by `fixture.whenStable()`. After triggering such handlers, flush manually before asserting: `await new Promise(r => setTimeout(r, 50));`.
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

## Ticket management (idea → kanban)

The project uses a 3-layer pipeline to track feature ideas and bugs:

| Layer   | Where                                | Purpose                                  |
| ------- | ------------------------------------ | ---------------------------------------- |
| INBOX   | `docs/ideas.md`                      | Raw uncommitted ideas, captured verbatim |
| BACKLOG | GitHub Issues + kanban Project #6    | Committed topics with status/discussion  |
| DETAIL  | `docs/superpowers/specs/` + `plans/` | Precise what/how, linked to the issue    |

Workflow: **oral idea → append to `docs/ideas.md` → clarify → GitHub issue → kanban card → groom → spec → plan → implement → PR with `Closes #N`**.

- Kanban = GitHub Projects **#6** "@xLeDocteurx's River King Kanban". Owner: `xLeDocteurx`.
- Status transitions: `Backlog → Ready → In progress → In review → Done`. Use `gh project item-edit 6 --owner xLeDocteurx --field "Status" --value "<option>"`.
- Add cards with `gh project item-add 6 --owner xLeDocteurx --url <issue-url>`.
- Run `gh` through devbox and strip its startup noise:
  `devbox run gh … 2>&1 | grep -v "devbox\|Welcome\|Node.js version\|npm version\|^$\|Running script\|v22\|10.9"`
- **Full workflow reference:** the `ticket-management` skill (`.opencode/skills/ticket-management/SKILL.md`).

---

## Git workflow

- **Main branch:** `main`
- **Feature branches:** `feature-<ticket_number>` (e.g., `feature-42`)
- **Commit messages:** prefix with the branch name, e.g. `feature-42: add login form`
- The initial project setup commit (this repo's first commit) has **no prefix**.
- **Auto-delete:** GitHub's "auto-delete head branches" is enabled — a `feature-*` branch is
  deleted automatically as soon as its pull request is merged. Do not restore or reuse a
  merged branch; always branch from `main` again.

---

## Gotchas

- Do not change `styles.ts` to something else; `src/styles.scss` is the single SCSS entry point referenced in `angular.json`.
- `@angular/build:unit-test` does **not** read a custom `vitest.config.ts`. If test behavior needs changing, check `angular.json` test options or `tsconfig.spec.json`.
- Because Tailwind prefix is `tw-`, standard Tailwind classes like `bg-red-500` will **not** work. Always write `tw-bg-red-500`.
- `core/` must stay independent; it is not allowed to import from `shared/` or `features/`.
- `features/` should expose lazy-loaded routes (e.g., `loadChildren`) and keep internal services/components private to the feature.
- **All singleton services** (DatabaseService, ThemeService, NotificationService, SessionService) must live in `core/services/`, never in `shared/services/`.
- **Never inline templates** in `@Component({ template: \`...\` })`. Always use `templateUrl`and`styleUrl` pointing to separate files.
- In environments where bare `npm` resolves to Windows binaries over UNC paths (WSL shares), always run commands through `devbox run ...`; plain `npm run test` may fail with `'ng' is not recognized`.

## Collaboration preferences

- **English-only GitHub-facing content:** everything visible on GitHub (About, README, pull
  requests, issues, comments, reports) must be written in English. Internal scratch docs such
  as `docs/ideas.md` may stay in French.
- The user likes to be **challenged** on their proposals: question assumptions, point out design risks, and suggest alternatives instead of implementing requests blindly.
