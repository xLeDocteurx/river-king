# Features

Chaque sous-dossier représente une **feature métier** indépendante du reste de l'application.

## Structure attendue d'une feature

```
features/{feature-name}/
├── components/       # composants propres à la feature
├── pages/            # pages / écrans accessibles par le routeur
├── services/         # services internes à la feature
├── models/           # modèles et DTOs spécifiques
└── {feature}.routes.ts # lazy-loaded routes
```

## Règles

- Une feature ne doit **jamais importer** les services/internals d'une autre feature.
- Les features communiquent via `core/services/` (state global) ou via événements.
- Les routes sont lazy-loaded : `loadChildren` / `loadComponent`.
