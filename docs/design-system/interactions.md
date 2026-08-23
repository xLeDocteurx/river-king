# Interactions

## Hover

Every interactive surface shows a visible hover state — border/text shifting to `accent`
(cards, dashed rows) or a subtle background shift (ghost buttons, list rows) — combined with
`tw-transition`. Non-interactive surfaces get no hover styling.

Explicitly set `tw-cursor-pointer` on clickable non-button surfaces (buttons don't inherit it
from Tailwind preflight).

## Keyboard

Custom interactive surfaces (cards, list rows) must be keyboard-operable:

```html
role="button" tabindex="0" (keydown.enter)="activate()" (keydown.space)="activate()"
```

The global `:focus-visible` accent ring comes for free — never remove it, never add custom
focus styles. Interactive elements hidden until parent hover must also become visible on
keyboard focus (`focus-visible:tw-opacity-100`, see destructive icon button).

Nested controls inside an interactive surface stop propagation for click AND keydown so the
parent doesn't activate (reference: project-card delete button).

## Selection

Single-select lists follow the selectable-list-item recipe: `muted` fill + `font-medium`
marks the selected row; hover alone never persists selection. Escape closes dialogs (native
`<dialog>` behavior).

## Destructive actions

Any data-destroying action (delete project/tile/sprite/scene) goes through
`rk-confirm-dialog` — never immediate, never browser `confirm()`. The confirm button uses
the destructive variant. The `destructive` color is reserved for these affordances and error
feedback.

## Async feedback

IndexedDB and other async operations are wrapped in `try/catch`; failures call
`notification.error(message)` (toast, auto-dismissed). Optional success confirmation via
`notification.success(...)`. Never swallow errors silently. Toasts are provided by
`<rk-toast />` mounted once at the root.

## Loading states

Intentionally unspecified until a screen needs one. When the first case appears, define the
pattern here and follow it everywhere else.
