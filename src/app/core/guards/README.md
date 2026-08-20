## Guards

Route guards de navigation.

## Conventions

- Retourner `boolean | UrlTree | Observable<boolean | UrlTree>`.
- Ne pas appeler de services UI directement (snackbar/toast) ; lever une erreur ou rediriger.
