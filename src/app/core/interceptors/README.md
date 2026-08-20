## Interceptors

Intercepteurs HTTP.

## Conventions

- Chaîner proprement avec `next.handle(req)`.
- Centraliser le retry / refresh token ici.
- Logger en dev uniquement (vérifier `isDevMode()`).
