## Services

Services utilitaires et helpers réutilisables.

## Conventions

- `providedIn: 'root'` par défaut.
- Noms suffixés par `Service`.
- Exposer l'état via des **signals** quand c'est pertinent.

## SessionService

Manages per-project session persistence:

- `getSession(projectId)` — Retrieve saved session state
- `saveSession(session)` — Save or overwrite session
- `updateSession(projectId, updates)` — Partial update
- `deleteSession(projectId)` — Remove session

Used by the Scene Editor to restore camera position and selected scene.
