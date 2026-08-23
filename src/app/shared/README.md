# Shared

Ce dossier centralise tout ce qui est **réutilisable** à travers plusieurs features : composants, services d'aide, modèles de données, pipes, directives.

## Sous-dossiers

| Dossier       | Contenu                                                                                                                                 |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `components/` | Composants headless / UI réutilisables (ex: Button, Dialog, Input). Doivent être **stateless** et pilotés par `@Input()` / `@Output()`. |
| `services/`   | Services utilitaires pouvant être injectés n'importe où (ex: DateFormatterService, NotificationService).                                |
| `models/`     | Interfaces et types TypeScript communs (ex: `User`, `ApiResponse<T>`). Pas de logique métier ici.                                       |
| `directives/` | Directives d'attribut structurelles ou comportementales (ex: `autofocus`, `clickOutside`).                                              |
| `pipes/`      | Pipes de transformation de données purs (ex: `fullDate`, `fileSize`).                                                                   |

## Règles

- Tout ce qui est dans `shared` doit être **indépendant d'une feature**.
- Les composants UI doivent être **headless** si possible : le style est appliqué par les classes Tailwind passées en `@Input()`.
- Utiliser `ChangeDetectionStrategy.OnPush` sur les composants partagés.
