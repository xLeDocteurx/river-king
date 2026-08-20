## Components

Composants UI réutilisables et **headless** (ou faiblement stylisés).

## Conventions

- Préfixe : `rk` (River King), ex: `rk-button`, `rk-dialog`.
- `ChangeDetectionStrategy.OnPush` obligatoire.
- Accepter `class` en input pour la personnalisation Tailwind : `class = input<string>('');`.
- Ne pas dépendre de services métier ni de routes.
