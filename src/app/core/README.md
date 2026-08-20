# Core

Dossier réservé aux éléments de l'application qui doivent exister en **singleton** et être importés **une seule fois** au niveau de la racine (`AppConfig`).

## Sous-dossiers

| Dossier         | Contenu                                                            |
| --------------- | ------------------------------------------------------------------ |
| `services/`     | Services singleton (ApiService, ThemeService, LoggerService, etc.) |
| `guards/`       | Route guards (auth, roles, feature flags)                          |
| `interceptors/` | HTTP interceptors (token, error handling, logging)                 |

## Règles

- **Ne jamais importer** `core/*` dans `shared/`. `core` est le fondement, pas une dépendance partagée.
- Tous les services ici sont `providedIn: 'root'`.
- Préférer les **signals** (`writableSignal`, `computed`) pour l'état global réactif.
