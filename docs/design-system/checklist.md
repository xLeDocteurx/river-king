# Delivery Checklist

Mandatory before delivering any UI work — new components, new screens, restyling passes.
Every item applies to both themes.

- [ ] **No hardcoded colors** — only token-bound `tw-*` classes; no hex/rgb/hsl, no raw
      Tailwind palette classes.
- [ ] **Both themes verified** — toggled light AND dark; nothing unreadable in either.
- [ ] **Shape discipline** — radii ≤ `tw-rounded-sm`; no blurred shadows, no pills, no
      gradients.
- [ ] **Keyboard + focus** — every interactive element reachable and operable by keyboard;
      focus ring visible; nested controls stop propagation.
- [ ] **English copy** — all UI text in English, no exceptions.
- [ ] **Type scale respected** — meta text 11px muted-foreground; standard UI 12px; section
      labels uppercase tracking-wider; no ad-hoc font sizes.
- [ ] **Token semantics** — `primary` for the single main action, `accent` for
      highlight/hover/focus, `destructive` only for danger.
- [ ] **Destructive flows** — confirm-dialog in front of every data-destroying action.
- [ ] **Async errors surfaced** — failures reported via NotificationService, never swallowed.
- [ ] **README updated** — when adding or changing major features or architecture,
      update the README `Features` and `Architecture Overview` sections to keep the
      project pitch accurate and current.
- [ ] **Status bar present** — screen renders the status bar with meaningful contextual info
      on the left.
- [ ] **Test hooks** — `data-testid` attributes on elements tests will target.
