# Foundations

## Identity — "Pro Editor"

The application looks like a professional pixel-art editor (VS Code / Aseprite spirit).

- **Dense** — compact paddings (`tw-p-3` cards, `tw-px-3 tw-py-1.5` buttons), small text,
  tight grids (`tw-gap-3`).
- **Crisp** — flat fills, 1px borders, sharp corners (2px maximum radius).
- **Sober** — color carries meaning (action / highlight / danger), never decoration.

Forbidden by default: decorative gradients, blurred shadows (`tw-shadow-*`), pill shapes,
radii larger than `tw-rounded-sm`, warm accent hues (amber/orange).

## Color tokens

Tokens are CSS custom properties in `src/styles/theme.scss`, mapped to Tailwind classes in
`tailwind.config.js`. Hardcoded hex/rgb/hsl values and raw Tailwind palette classes
(`tw-bg-red-500`) inside components are forbidden.

| Token classes                                  | Role             | Use for                                                             | Never use for           |
| ---------------------------------------------- | ---------------- | ------------------------------------------------------------------- | ----------------------- |
| `tw-bg-background` · `tw-text-foreground`      | Page base        | Screen background, base text                                        |                         |
| `tw-bg-card-bg` · `tw-text-card-fg`            | Elevated surface | Cards, panels, popups, list containers                              |                         |
| `tw-bg-muted`                                  | Subtle surface   | Bars (topbar), selected list rows                                   | Main actions            |
| `tw-text-muted-foreground`                     | Secondary text   | Meta lines, section labels, inactive elements                       | Body copy               |
| `tw-bg-primary` · `tw-text-primary-foreground` | Action           | The single primary button per view; status bar fill                 | Decoration, large fills |
| `tw-accent-*`                                  | Highlight        | Hover border/text, focus ring, text selection, active tab underline | Large fills             |
| `tw-destructive`                               | Danger           | Delete affordances, error feedback                                  | Anything else           |
| `tw-border-border`                             | Structure        | 1px borders between regions, cards, inputs' container               |                         |
| `tw-border-input`                              | Inputs           | Form field borders                                                  |                         |

The `secondary` tokens exist but are rarely needed — prefer `muted`.

Sparing opacity modifiers on token colors are acceptable where already proven
(`hover:tw-bg-destructive/10`, `tw-border-border/50`); prefer solid token fills otherwise.

## Themes

Light (`:root`) and dark (`.dark`) have strict parity: every rule applies to both. Verify
every new style under both themes using the topbar toggle. If contrast fails in one theme,
fix it at the token level — never with a theme-specific hack inside a component.

## Typography & density

Root font-size is 14px (set globally in `styles.scss`). Never set `font-size` on `html`
locally; rem-based utilities inherit the density.

| Level                   | Classes                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------- |
| Meta / auxiliary (11px) | `tw-text-[11px]` (+ `tw-text-muted-foreground` for secondary meta)                    |
| Standard UI text (12px) | `tw-text-xs`                                                                          |
| Titles                  | `tw-text-sm tw-font-semibold`                                                         |
| Dialog titles           | `tw-text-xl tw-font-bold`                                                             |
| Section labels          | `tw-text-xs tw-font-semibold tw-uppercase tw-tracking-wider tw-text-muted-foreground` |

## Shape & global conventions

Applied globally once (`styles.scss`); never re-implement locally:

- **Radius:** max `tw-rounded-sm` (2px) on buttons, inputs, cards, dialogs — everything.
  No pills.
- **Focus:** `:focus-visible` renders a 1px solid `accent` outline at `-1px` offset. Never
  remove it and never add replacement focus styles.
- **Scrollbars:** slim, transparent track, thumb `border` → hover `muted-foreground`.
  Do not restyle per component.
- **Text selection:** accent-tinted globally. Do not restyle.

## Icons

Material Symbols only (webfont declared in `theme.scss`):

```html
<span class="material-symbols" aria-hidden="true">add</span>
```

Always with `aria-hidden="true"` when decorative. Sizes: `tw-text-sm` inline next to 12px
text · `tw-text-base` standalone ghost icon buttons · `tw-text-5xl` empty-state illustrations.
