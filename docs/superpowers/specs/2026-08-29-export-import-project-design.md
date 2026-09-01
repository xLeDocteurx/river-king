# Export / Import de projet (.rkproj) — Design

Issue : #2. Statut : cadrage validé (déviation brainstorming via délégation).

## Contexte et objectif

Les projets River King ne vivent qu'en IndexedDB : impossibles à récupérer hors
navigateur, à sauvegarder, ou à transférer sur une autre machine. On veut pouvoir
exporter un projet complet vers un fichier téléchargeable, et réimporter ce fichier
(comme nouveau projet, ou pour remplacer un projet existant).

Le fichier joue un double rôle : **sauvegarde portable** du travail utilisateur et
**format d'échange** entre instances du moteur.

### Décisions produit actées (avec l'utilisateur)

1. **Conteneur : un seul fichier `.rkproj`** — JSON dont les images (les
   `Sprite.pixelData`, déjà des data URIs PNG base64) sont **embarquées telles
   quelles**. Satisfait l'AC « images embarquées (base64/atlas) », sans dépendance
   zip et sans ré-encodage (round-trip **lossless**).
2. **Import = choix explicite** : « créer un nouveau projet » ou « remplacer un
   projet existant » (sélecteur + confirmation).
3. **UI : dashboard uniquement** — bouton Export par carte projet (au survol, à
   côté de Delete), bouton Import dans le header du dashboard (à côté de New
   Project). Rien dans le topbar ni dans les éditeurs.

## Format du fichier (DTO)

```ts
export const PROJECT_ARCHIVE_FORMAT = 'river-king-project';
export const PROJECT_ARCHIVE_VERSION = 1;

export interface ProjectArchive {
  format: typeof PROJECT_ARCHIVE_FORMAT; // 'river-king-project'
  formatVersion: number; // 1
  exportedAt: number; // epoch ms
  project: {
    name: string;
    palette: string[]; // hex '#rrggbb'
    tileSize: number;
    mapWidth: number;
    mapHeight: number;
  };
  tiles: TileArchiveItem[];
  sprites: SpriteArchiveItem[];
  scenes: SceneArchiveItem[];
  folders: string[]; // chemins de dossiers de scènes
}

export interface TileArchiveItem {
  sourceId: number; // db.tiles.id à l'export
  name: string;
  type: 'static' | 'animated';
  spriteIds: number[]; // sourceIds de sprites, ordre = ordre frames
  animationSpeed: number;
  properties: TileProperties;
  folderPath: string; // '' = racine
}

export interface SpriteArchiveItem {
  sourceId: number; // db.sprites.id à l'export
  tileSourceId: number; // db.sprites.tileId à l'export
  name: string;
  width: number;
  height: number;
  pixelData: string; // data URI PNG base64, inchangée
  paletteIndices?: number[][]; // grille d'indices, inchangée
}

export interface SceneArchiveItem {
  name: string;
  folderPath: string; // '' = racine
  width: number;
  height: number;
  layers: Layer[]; // tileData = sourceIds de tiles
}
```

Exclusions décidées : `Session` (état UI éphémère), les UUID d'`id`/`projectId`
régénérés à l'import, `createdAt`/`updatedAt` régénérés. SourceIds présents
uniquement pour permettre le remappage des références (tiles↔sprites, `tileData`).

JSON compact (pas de pretty-print), ordre déterministe (tiles/sprites triés par
id) pour la reproductibilité du fichier.

## Service cœur : `ProjectIoService` (`core/services/`)

`providedIn: 'root'`. Seul point de vérité de la sérialisation ET du remappage.
Utilise `DatabaseService` directement (verrou core indépendant respecté). Aucune
importation depuis `features/`.

```ts
export type ImportMode = { kind: 'new' } | { kind: 'replace'; targetProjectId: string };

export interface ImportResult {
  projectId: string;
  kind: 'new' | 'replace';
}

export class ProjectIoService {
  exportProject(projectId: string): Promise<string>; // JSON string
  importProject(fileText: string, mode: ImportMode): Promise<ImportResult>;
}
```

### Export (`exportProject`)

1. Lit `projects`, `tiles where projectId`, `sprites where projectId`,
   `folders where projectId`, `scenes where projectId`.
2. Trie tiles et sprites par id (déterministe).
3. Construit `ProjectArchive` (pixelData/paletteIndices copiés à l'identique).
4. `JSON.stringify`. Le téléchargement (Blob + ancre `<a download>`) reste côté
   UI (dashboard), pas dans le service — le service retourne la chaîne JSON.

### Import (`importProject`) — remappage atomique

Toute la mutation tourne dans une unique
`db.transaction('rw', [projects, tiles, sprites, scenes, folders])` → tout-ou-rien.

Validation (avant transaction) — chaque échec lève `ProjectImportError(message)`
avec message utilisateur-lisible :

- JSON invalide → « This file is not a valid project file. »
- `format !== 'river-king-project'` → « This file is not a River King project export. »
- `formatVersion !== 1` → « This project file uses an unsupported version (…). »
- Champs requis absents/mal typés (`project.name` non-string, `palette` non `string[]`,
  tableaux tiles/sprites/scenes absents, champs Tile/Scene.) → « This file is
  missing required data. »
- **Intégrité des références** (strict, pas de corruption silencieuse) :
  - un `sprite.tileSourceId` sans tile correspondant → error ;
  - un `tile.spriteIds[n]` sans sprite correspondant → error ;
  - une valeur `tileData >= 0` sans tile correspondant → error ;
  - tiles/scenes vides interdits uniquement par cohérence de type (un projet sans
    aucun tile reste exportable/importable).

Étapes dans la transaction (ordre qui ne dépend d'aucun compteur — l'auto-incrément
des tiles/sprites ne descend jamais, donc purger avant d'insérer ne change pas le
remappage) :

1. **Mode `replace`** : purge les lignes du projet cible (`scenes`/`tiles`/
   `sprites`/`folders`/`sessions where projectId`). On ne supprime PAS `projects`
   ici — on le fera avant sa ré-insertion en fin de transaction.
   **Mode `new`** : `projectId = crypto.randomUUID()`.
2. Insère les tiles (`spriteIds: []` provisoires), mémorise le mapping
   `sourceId → nouveau id` dans `tileIdMap`.
3. Insère les sprites avec `tileId = tileIdMap.get(sprite.tileSourceId)`, mémorise
   `spriteIdMap`.
4. Met à jour chaque tile : `spriteIds = spriteIds.map(sid => spriteIdMap.get(sid))`
   (préserve l'ordre des frames).
5. Insère les scènes avec `projectId`, `tileData` remappé
   (`tid < 0 → tid`, sinon `tileIdMap.get(tid)`), chemins préservés.
6. Insère les dossiers de scènes avec `id` frais (`crypto.randomUUID()`).
7. **Projet** : mode `replace` → `db.projects.delete(target)` puis
   `db.projects.add({ id: target, ... })` (nom d'archive, createdAt/updatedAt =
   `Date.now()`). Mode `new` → `db.projects.add({ id: uuid, ... })`. En mode
   `new`, le nom d'archive est conservé tel quel (les doublons de nom sont
   tolérés — pas d'index unique).

Retourne `{ projectId, kind }`.

#### Décision « nom à l'import »

- **`new`** : nom d'archive conservé (sans suffixe — les doublons sont autorisés
  en base).
- **`replace`** : le fichier est **l'autorité** — le nom d'archive remplace celui
  du projet cible.

#### Rollback

La transaction Dexie garantit l'atomicité. La purge du ciblé (mode `replace`)
vient **en premier**, et l'insertion du projet **en dernier** : toute erreur en
cours de remplissage (insertions de tiles/sprites/scènes) laisse l'ancien contenu
cible intact — rien n'est détruit tant que la nouvelle base n'est pas écrite. Un
test dédié le vérifie (import remplaçant défaillant ne touche pas le projet cible).

## Composants UI (dashboard)

### Export — carte projet (`project-card.component`)

- Bouton icône « Export » au survol, à côté du bouton Delete existant
  (Material Symbol `download`, title/tooltip « Export project »).
- Action : `inject(ProjectIoService).exportProject(project.id)` → Blob + ancre
  `<a download>` ; nom de fichier `river-king-<slug-id>.rkproj` (slug : nom bas
  de casse, non-alphanum → `-`). Erreur → `NotificationService.error`.
- Les erreurs de la carte passent par l'existant ; nouveau composant/extension.

### Import — dashboard (header) + dialog

- Bouton « Import » dans le `<header>` du dashboard (à côté de « New Project »),
  qui déclenche un `<input type="file" accept=".rkproj,application/json">` masqué.
- À la sélection : lecture `file.text()`, **pré-validation** via le service
  (parsing + intégrité) réalisée dans le handler. Si invalide → `notification.error`.
- Si valide → ouvre `rk-import-project-dialog` (nouveau composant de la feature,
  dans `features/dashboard/import-project-dialog/`) qui affiche :
  - le nom du projet importé + résumé (N tiles, M frames, S scènes, palette) ;
  - un radio « Create a new project » (défaut) / « Replace an existing project »
    - `<select>` alimenté par la liste des projets courants ;
  - Confirm → `importProject(fileText, mode)` ; succès → `notification.success`
    - rafraîchissement de la liste (émission vers le dashboard parent, qui
      recharge).
- `rk-dialog` natif (`<dialog>`) pour le modale, `rk-confirm-dialog` **non**
  requis ici (le mode replace est déjà confirmé par le choix explicite dans le
  dialog d'import).

## Gestion d'erreurs

- Toutes les erreurs async (`exportation`/`importation`) → `notification.error()`
  avec le message ; le service lève `ProjectImportError` porteur du message
  utilisateur (jamais de stack brute affichée).
- Le parsing est **strict** (voir validation) : un fichier édité à la main qui casse
  une référence est refusé explicitement, jamais importé partiellement.

## Tests prévus

### `project-io.service.spec.ts` (fake-indexeddb, pas de DOM)

1. **Round-trip export** : seed 1 projet (palette 4, tileSize 16, 40×30) + 2 tiles
   (static/en-tête animé) + 3 sprites (dont multi-frame) + 2 scènes (layers avec
   tileData réels + -1/0) + 2 dossiers → `exportProject` → parse JSON : `format`,
   `formatVersion`, `project` fidèle, ordre `spriteIds` préservé, `pixelData`
   identique octet à octet, tri par id.
2. **Import `new`** : export A → vider la base → import `{kind:'new'}` → nouveau
   `projectId` ≠ source, nom d'archive conservé, `tileIdMap`/`spriteIdMap` tous
   différents des sourceIds, `tile.spriteIds` réécrits dans l'ordre, `sprite.tileId`
   remappé cohérent avec le back-link spriteIds, `scene.layers.tileData` remappé en
   conservant les -1, `folders` présents, palette/tileSize/mapW/H conservés,
   absence de `sessions`.
3. **Import rejoué** : deux imports successifs → 2 projets distincts, chacun
   auto-cohérent (back-links vérifiés).
4. **Import `replace`** : export A ; créé projet cible B (nom « Old », contenu
   quelconque) ; import `{kind:'replace', targetProjectId:B}` → B reçoit le contenu
   A, nom = nom d'archive, `projectId` inchangé, sessions supprimées.
5. **Rollback** : import `replace` avec archive cassée (référence tileData →
   sourceId inconnu, détectée à la validation AVANT transaction) → projet B
   intact à 100 %. Et un échec MAUVAIS en cours de transaction (simulé par mock
   d'un insert) → B parfaitement intact après rollback.
6. **Validations** : non-JSON, mauvais `format`, version inconnue, `project.name`
   manquant, sprite orphelin, `spriteIds` ref inconnue, `tileData` ref inconnue →
   chacun lève `ProjectImportError` avec message attendu.

### `import-project-dialog.component.spec.ts`

- Affiche nom + résumé ; radio « new » par défaut ; switch replace active le select ;
- Confirm émet/mode attendu ; sélection vide → confirm désactivée.

### `project-card.component.spec.ts`

- Le bouton Export est présent au survol ; clic → `exportProject` appelé avec
  l'id ; téléchargement déclenché (spy sur `URL.createObjectURL` + clic ancre).
- En cas d'erreur export → `NotificationService.error` (spy).

### `dashboard.component.spec.ts`

- Bouton Import présent ; clique → ouvre le file picker (spy) ; sélection d'un
  fichier valide → le dialog s'ouvre ; import confirmé → liste rafraîchie.

## Impact & conformité

- **core** : `ProjectIoService` + `ProjectImportError` dans `core/services/`
  (aucune import de `shared/`/`features/`). Modèle d'archive dans `shared/models/`
  (modèle pur).
- **features** : `dashboard` gagne `import-project-dialog/` (sous-dossier de la
  feature) ; `project-card` étendu. Ne touche pas les éditeurs.
- **UI copy** : anglais uniquement. Icônes Material Symbols. Tokens Tailwind
  préfixés `tw-`. Boutons/icônes interactifs : `tw-cursor-pointer`.
- **Budget** : aucun poids runtime ajouté (les data URIs existent déjà en base).

## Hors périmètre (refusés)

- Archive `.zip` / atlas séparé (tranché).
- Ré-encodage/re-échantillonnage des images (tranché : base64 tel quel).
- Export de l'état UI (`Session`), de l'historique undo/redo, des projets tiers.
- Ouverture distante (import de l'export des autres instances nécessaire, pas de
  cloud).
- Migration de versions anciennes du format (à venir quand un format v2 existera).
