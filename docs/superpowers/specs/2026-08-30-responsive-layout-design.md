# Responsive Layout Design

**Date:** 2026-08-30
**Status:** Draft
**Linked issue:** #23

## Problem

Le projet est desktop-fixed-width par construction. Seul le dashboard est responsive
(`dashboard.component.html:37` — la seule utilisation de breakpoints Talwin du repo). Les
trois éditeurs sont des rangées flex à largeur fixe de panels `shrink-0` (224px + 208px =
432px), tous enveloppés par un sidebar projet fixe 256px, sans aucune règle `@media` ni
breakpoint dans le code (zéro `@media` dans tous les `*.scss`, un seul usage de
`sm:/md:/lg:` dans tous les `*.html`). Résultat à ~360px de large :

| Surface | Config sidebar+panels fixes | Tient à 360px ? |
|---|---|---|
| Dashboard | fluide (`grid-cols-1` base) | Oui |
| Scene editor | 224 + 208 = 432px | Non |
| Tile manager | 224 | Non (avec sidebar projet) |
| Sprite editor | 224 + 208 = 432px | Non (pire de tous) |
| Project shell | + 256px sidebar sur tout | Non |

En plus, la topbar (35px) déborde sur les routes projet (brand + 3 onglets + bouton thème,
pas de wrap/truncate), et le `project-shell` imbrique un `h-screen` (100vh) dans un `main`
de 100vh − 35 − 22 avec `overflow-hidden` → dépassement de hauteur de 57px.

## Solution

Rendre les trois éditeurs (scene, tile, sprite) et la topbar utilisables à largeur réduite
via une combinaison de **breakpoints Tailwind** et de **panels pliables**, en intégrant le
sidebar projet (qui devient repliable/empilable) et en corrigeant le bug de hauteur du shell.

Cible: **utilisable à 640px (sm)**, **non-débordant à 360px**.

## Design decisions

**Finalized 2026-08-30**

- **Périmètre:** les 3 éditeurs (scene/tile/sprite) + la topbar + le project shell
  (sidebar projet + hauteur).
- **Stratégie:** breakpoints + panels pliables (pas de scroll horiz. par panel, pas de
  `min-width` de page). Sous le breakpoint, les panels deviennent pliables/empilables pour
  libérer le canvas.
- **Cible de largeur:** `sm` (640px) utilisable ; 360px non-débordant (pas nécessairement
  pleine fonctionnalité).
- **Topbar:** on conserve les 3 onglets nav ; la brand est rétrécie/trunkée à mobile
  (ex. masquer le texte, garder le carré accent). La nav devient non-débordante
  (`overflow-x-auto` / `flex-1 min-w-0` selon besoin).
- **Project shell:** le sidebar projet (256px, redondant avec la topbar nav : Scenes/Tiles/
  Sprites) devient repliable/empilable sous le breakpoint ; le `h-screen` imbriqué est
  corrigé (hauteur calculée / flex-1 au lieu de 100vh dans le main).
- **Valeur de breakpoint:** breakpoints Tailwind par défaut (sm=640, md=768). Les panels
  d'éditeurs se replient typiquement sous ~768px ; le shell se réorganise sous ~640px.

## Architecture

### Principes

- Utiliser exclusivement des utilitaires Tailwind avec les breakpoints initiaux (`sm:`,
  `md:`) — pas de `@media` SCSS maison, cohérent avec le reste du repo.
- Les panels d'éditeurs deviennent **pliables** : garder la disposition côte à côte au
 -dessus du breakpoint, et sous le breakpoint proposer un **toggle** (Material Symbol)
  par panel pour le replier et libérer le canvas, ou un empilement vertical.
- Éviter de réécrire la logique métier : seul le layout (classes de conteneur) change.

### Surfaces concernées

1. **Topbar** (`src/app/app.component.html`)
   - `log` `River King Engine` : à `sm`, masquer le texte de la brand (garder le carré
     accent) pour ne jamais déborde.
   - Nav (3 onglets) : `flex-1 min-w-0` + éventuellement `overflow-x-auto` sous `sm`.
   - Bouton thème : conservé.
2. **Project shell** (`src/app/features/project/project-shell.component.html` +
   `project-sidebar.component.html`)
   - Corriger le bug de hauteur : remplacer `tw-h-screen` du shell par une hauteur qui
     s'inscrit dans le `main` de l'app (`tw-h-full` + le `main` de l'app étant
     `flex-1 overflow-hidden`), ou ajouter `height: calc(100vh − 35px − 22px)`.
   - Sidebar (256px `tw-w-64` + `shrink-0`) : sous `md`, repliable (toggle) ou masqué au
     profit de la topbar nav ; au-delà, conservé tel quel.
3. **Scene editor** (`src/app/features/scene-editor/scene-editor.component.html`)
   - Left scene list (`tw-w-56 shrink-0`, ligne 3) + right minimap/layers/palette
     (`tw-w-52 shrink-0`, ligne 36) : pliables/toggables sous `md`.
   - Center (`tw-flex-1 relative overflow-hidden`) : reste le canvas ; `overflow-hidden`
     remplacé par `overflow-auto` lorsque le canvas est plus grand que le slot.
4. **Tile manager** (`src/app/features/tile-manager/tile-manager.component.html`)
   - Left tree (`tw-w-56 shrink-0`, ligne 2) : pliable sous `md`.
   - Right properties (`tw-flex-1 overflow-auto`) : déjà scrollable.
5. **Sprite editor** (`src/app/features/sprite-editor/sprite-editor.component.html`)
   - Left tile list (`tw-w-56 shrink-0`, ligne 3) + right palette/tools
     (`tw-w-52 shrink-0`, ligne 157) : pliables/toggables sous `md`.
   - Center (`tw-flex-1 overflow-auto`) : déjà scrollable.

### État des panels (pliés/dépliés)

- Aucun modèle de données supplémentaire requis : l'état de repli des panels est un état
  **local de composant** (signaux), non persistant (contrairement au smart folding `#17`
  qui persiste). Les panels reviennent à l'état par défaut à chaque navigation.
- On peut réutiliser le pattern du toggle de la grid (`GRID_VISIBLE_STORAGE_KEY` en
  sessionStorage dans `map-canvas.component.ts`) si on veut persister, mais par défaut
  l'état de repli est éphémère — décision par défaut : **non persistant** pour rester
  simple.

## UI/UX details

- Toggle de panel : bouton avec Material Symbol (ex. `chevron_left`/`chevron_right` ou
  `menu_open` selon le sens), visible uniquement sous le breakpoint (masqué au-dessus).
  Style conforme (hover + `tw-cursor-pointer`, focus ring conservé).
- La disposition reste côte à côte au-dessus du breakpoint — aucun changement sur desktop.
- Sous `sm`, la topbar ne déborde jamais : la brand rétrécit, la nav peut scroller.
- Pas de nouvelle surface UI permanente : les toggles n'apparaissent que sous le
  breakpoint (utilitaires masquant par défaut).

## Data model changes

Aucune. Le responsive est purement de la présentation ; aucun changement de schéma
Dexie, de modèle ou de service.

## Testing

- Tests de composants existants (scene-editor, tile-manager, sprite-editor, dashboard)
  : ils doivent rester verts — le changement se limite aux classes de conteneur, pas à la
  logique.
- Tests de dom : vérifier que les classes utilitaires des breakpoints sont présentes dans
  les templates (peu de valeur à tester le responsive CSS réel en jsdom).
- Vérification manuelle aux 3 largeurs : 1280+/768 (côte à côte), 640 (pliable),
  360 (non-débordant).
- `npm run build` et `npm run lint` doivent passer.

## Performance considerations

- Aucun impact runtime mesurable : changement purement CSS/Tailwind.
- Éviter de dupliquer les panels dans le DOM (pas de rendu de versions mobile ET desktop
  simultanément) — utiliser le toggle pour cacher/afficher, pas cloner.

## Out of scope

- Pleine fonctionnalité à 360px (cible = non-débordant à 360px, utilisable à 640px).
- Rendre le layout resizable par l'utilisateur (drag de séparation des panels).
- Persistance de l'état de repli des panels.
- Support tactile avancé (gestes draw/pan) — hors périmètre présent.
- Refonte visuelle : pas de changement de design au-dessus du breakpoint.
