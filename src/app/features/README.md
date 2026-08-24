# Features

Chaque sous-dossier représente une **feature métier** indépendante du reste de l'application.

## Structure attendue d'une feature

```
features/{feature-name}/
├── {child}/                 # un sous-dossier par composant enfant
│   └── {child}.component.{ts,html,scss,spec.ts}
├── services/                # services internes à la feature
├── {feature}.component.{ts,html,scss} # shell de la feature
└── {feature}.routes.ts      # lazy-loaded routes
```

## Règles

- Une feature ne doit **jamais importer** les services/internals d'une autre feature.
- Les features communiquent via `core/services/` (state global) ou via événements.
- Les routes sont lazy-loaded : `loadChildren` / `loadComponent`.
