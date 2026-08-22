# Design — Rework de l'écran des Tiles

Date : 2026-08-22
Statut : approuvé en revue conversationnelle, en attente de validation écrite

## Contexte

L'écran Tiles expose des propriétés redondantes ou obsolètes (`collision` vs `solid`,
`layer` sur la tuile, `eventScript` libre) et ne propose aucun lien visuel avec les
sprites. Décisions prises avec le user :

- fusion collision/solid en un seul champ `blocking`
- suppression de `layer` (les layers seront gérés **par sprite**, plus tard — hors scope)
- suppression de `eventScript` au profit d'un registre d'actions typé
- gestion du cycle de vie des sprites d'une tuile directement depuis l'écran tiles
  (vignettes, frames animées, taille en unités de tiles)

## Modèle de données

### TileProperties (avant → après)

```ts
// AVANT
interface TileProperties {
  collision: boolean;
  solid: boolean;
  interactable: boolean;
  eventScript?: string;
  layer: 'background' | 'foreground';
}

// APRÈS
interface TileProperties {
  /** Blocks character movement across the tile. */
  blocking: boolean;
  /** Whether the tile triggers an action on interaction. */
  interactable: boolean;
  /** Key of the action in GAME_ACTIONS; undefined when not interactable. */
  actionId?: string;
}
```

Règles :

- `actionId` est mis à `undefined` à la sauvegarde si `interactable` est décoché.
- `actionId` doit exister dans `GAME_ACTIONS` ; si la clef disparaît du registre,
  l'éditeur affiche "(action inconnue)" et permet de choisir une autre valeur.
  Le runtime n'exécute rien pour une clef inconnue.

### Migration Dexie (version 3)

Les champs concernés ne sont pas indexés (`tiles: '++id, projectId, name, type'`) :
aucun changement de schéma d'index nécessaire. L'upgrade transforme les enregistrements :

```ts
this.version(3).upgrade(async (tx) => {
  await tx.table('tiles').toCollection().modify((tile) => {
    tile.properties = {
      blocking: Boolean(tile.properties?.collision || tile.properties?.solid),
      interactable: Boolean(tile.properties?.interactable),
      actionId: undefined,
    };
  });
});
```

## Registre d'actions

Fichier unique : `src/app/core/actions/game-actions.ts` (les actions sont du code de
jeu → `core`, pas du contenu DB).

```ts
export type GameActionHandler = () => void;

export const GAME_ACTIONS: Record<string, GameActionHandler> = {
  test: () => alert('alert'),
};

export function listGameActions(): string[];
export function runGameAction(id: string): void; // no-op si clef inconnue
```

- La clef sert de label affiché dans l'éditeur (v1).
- Format volontairement extensible : `{ id, label?, run, params? }` pourra remplacer
  `Record<string, handler>` sans changer ce qui est stocké sur les tuiles (l'id).

## Composant partagé rk-searchable-select

`src/app/shared/components/searchable-select/`

- Input : `options: string[]`, `value: string | null`, placeholder.
- Output : `valueChange`.
- Comportement : champ texte filtrant la liste au fur et à mesure (insensible à la
  casse), clic pour sélectionner, touche Escape ferme la liste, sélection affichée
  dans l'input.
- Headless (pas de couleurs codées en dur), accepte `class` pour le styling Tailwind,
  conforme aux conventions des composants shared.
- Pas de dépendance externe, pas de `<datalist>`.

## Écran Tiles

### Formulaire (tile-properties)

Ordre des champs : Name → Type → (contenu dépendant du type) → Animation Speed
(animated uniquement) → Size → Properties (blocking, interactable [+ dropdown]).

#### Type static

Sous le dropdown Type : une vignette (64×64) de la sprite liée (`spriteIds[0]`),
rendue depuis les données de sprite existantes (même décodage que le pixel-canvas ;
placeholder en pointillés si absente/vide). Clic → éditeur de sprite en mode focus
sur cette sprite.

#### Type animated

Sous le dropdown Type :

1. Sélecteur numérique « Frames » (min 1).
2. Rangée de vignettes (une par frame), cliquables → éditeur de sprite focus.

Cycle de vie automatique des frames :

- Augmenter N : création de sprites vierges liées à la tuile jusqu'à N.
- Réduire N : **confirmation obligatoire** (ConfirmDialogComponent) car suppression
  de données, puis suppression des sprites excédentaires.
- Passage static → animated : la sprite existante devient frame 1, les autres sont
  créées vierges.
- Passage animated → static : la frame 1 est conservée, les autres supprimées après
  la même confirmation.

#### Size (taille en unités de tiles)

- Deux champs numériques Width / Height (en tiles, min 1), côte à côte sous le bloc
  type/frames. Valeur par défaut issue de la sprite liée (ou 1×1).
- Application : multiplié par `project.tileSize` → redimensionne la/les sprites
  liées (toutes les frames) : mise à jour width/height en pixels ET des données
  pixels (réduction = crop centré en haut-gauche, agrandissement = padding vide).
- **Réduction → dialogue d'avertissement** (ConfirmDialogComponent, bouton
  « Crop ») : « réduire va rogner le contenu, risque de perte ». Agrandissement
  sans confirmation.

#### Interactable

Case cochée → affiche `rk-searchable-select` alimenté par `listGameActions()` ;
la sélection met à jour `properties.actionId`.

### Suppressions UI

`collision`, `solid`, `layer`, `eventScript` disparaissent du formulaire ;
`blocking` les remplace.

## Éditeur de sprite — mode focus

- Nouvelle route enfant optionnelle : `sprites/:spriteId` pointant vers le même
  `SpriteEditorComponent`. Présence du paramètre = mode focus.
- Mode focus : la sidebar listant toutes les sprites est masquée ; seule la sprite
  du paramètre est éditable ; un bouton « ← Back to tiles » navigue vers
  `/project/:projectId/tiles`.
- Sans paramètre : comportement actuel inchangé (liste complète, sélection libre).
- Si la sprite n'existe plus (id inconnu) : notification d'erreur + retour auto
  vers tiles.

## Aperçu des tuiles dans l'éditeur de scène

Le rendu actuel de `MapCanvasComponent` (couleur `palette[tileId % palette.length]`,
solution temporaire) est remplacé par l'image réelle de la tuile :

- Pour chaque `tileId` présent dans `scene.tileData`, charger la tuile et sa
  **première sprite** (`spriteIds[0]`) — statique comme animée.
- Préchargement des images (`HTMLImageElement` depuis `pixelData`) dans un cache
  par tileId ; re-render du canvas quand le cache change.
- Rendu : `drawImage` aux coordonnées grille (le translate/scale caméra existant
  s'applique), dimension = `tileSize` projet.
- Tuile sans sprite ou image non encore chargée → case vide (comme `-1`).
- Chargement fait côté scène (service du feature scene-editor), passé en input au
  canvas : `MapCanvasComponent` reste un composant d'affichage.

## Gestion des erreurs

Toutes les opérations IndexedDB ajoutées/modifiées sont wrappées try/catch avec
`NotificationService.error(...)` conformément à AGENTS.md. Succès notables
(suppression de frames, crop) → toast de confirmation.

## Tests

- `game-actions.spec.ts` : listage, exécution, clef inconnue (no-op).
- `searchable-select.component.spec.ts` : rendu des options, filtrage, émission,
  Escape.
- `tile-properties.component.spec.ts` :
  - vignette static cliquable (output navigate-to-sprite)
  - frames : augmentation crée N sprites, réduction demande confirmation puis
    supprime, static↔animated conserve/supprime selon règle
  - size : propagation aux frames, réduction déclenche l'avertissement, agrandissement non
  - interactable : dropdown visible ssi coché, actionId sauvegardé/nettoyé
- Migration v3 : tuile {collision:true,solid:false} → {blocking:true} ; tuile déjà
  convertie inchangée.
- Sprite editor focus mode : sidebar masquée avec param, présente sans.

## Hors scope explicite

- Layers (par sprite ou map) — future itération.
- Exécution réelle des actions en jeu (seul le registre + action test existent).
- Paramètres d'action (`params`) — structure prévue mais non implémentée.
