# Favicon et branding River King

Date: 2026-08-30
Status: Draft
Linked issue: #24

## Problem

Le `<title>` est « RiverKing » et le `favicon.ico` est celui par défaut d'Angular (icône générique). Il n'y a pas d'identité de marque cohérente dans l'onglet navigateur. Le corps de l'issue mentionnait « no favicon », mais un `favicon.ico` existe déjà (par défaut) — le vrai besoin est un favicon de marque plus des metadata cohérents.

## Solution

1. Remplacer `public/favicon.ico` par un favicon de marque aux couleurs River King.
2. Ajouter un `public/favicon.svg` moderne (fallback SVG, recommandé pour la résolution).
3. Mettre à jour `src/index.html` :
   - `<title>River King Engine</title>`
   - ajouter `<link rel="icon" type="image/svg+xml" href="favicon.svg" />` avant le `.ico`
   - ajouter `<meta name="description" …>` et `<meta name="theme-color" content="#005fb8" />` (couleur primaire claire)
4. Mettre à jour le corps de l'issue // spec (délivré ci-dessus).

## Design decisions (finalized 2026-08-30)

- **Favicon de marque** : oui — créer un favicon bleu River King à partir de la couleur primaire.
- **Nom de marque / title** : « River King Engine » (cohérent avec la status bar « River King Engine »), remplace « RiverKing ».
- **Pas de manifest PWA** : aucun manifest ni installabilité pour l'instant (pas d'exigence de PWA).

## Architecture

Aucun changement d'architecture. Uniquement des assets statiques dans `public/` et des métadonnées dans `src/index.html`.

## UI·UX details

- Favicon : fond bleu primaire (`#005fb8`) avec un motif « fleuve » blanc (lignes ondulées) — identité River King. `theme-color` = `#005fb8`.
- Le `favicon.svg` assure un rendu net à toutes les tailles ; le `favicon.ico` reste comme fallback.

## Data model changes

Aucun.

## Testing

Pas de test unitaire (assets statiques). Vérification : `npm run build` passe, `index.html` référencé correctement, pas de référence cassée.

## Performance considerations

Aucun impact (petits assets).

## Out of scope

- Manifest PWA / service worker / installabilité.
- Logo dans l'interface (écran de connexion, marque dans la barre).
