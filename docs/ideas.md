# Ideas & Backlog

Centralized list of feature ideas, UX improvements, and technical debt for the River King engine.

---

## High Impact

- [x] **Croissance auto de la map** — Placer des tuiles hors de la grille actuelle de la scène : la map (scène + toutes les couches) s'agrandit automatiquement quand une tuile est posée à l'extérieur de l'espace en mémoire. La grille doit être visible sur le canvas au-delà de la zone en mémoire pour que l'espace étendable soit découvrable. → [#7](https://github.com/xLeDocteurx/river-king/issues/7)
- [x] **Undo/Redo** — Stack d'actions dans les éditeurs (scene, sprite, tile). Stub existant dans `core/actions/game-actions.ts`. → [#1](https://github.com/xLeDocteurx/river-king/issues/1)
- [x] **Export/Import** — Exporter un projet (JSON, tilemap, atlas d'images). Importer un projet existant. → [#2](https://github.com/xLeDocteurx/river-king/issues/2)
- [x] **Status bar utile** — Coordonnées curseur, zoom, dimensions scène, nombre de tiles, etc. → [#3](https://github.com/xLeDocteurx/river-king/issues/3)

## Medium Impact

- [x] **Keyboard shortcuts** — Ctrl+Z undo, Delete, numéros pour switch d'outil, Ctrl+S save. → [#13](https://github.com/xLeDocteurx/river-king/issues/13)
- [x] **Visualisation des collisions/footprints** — Toggle pour voir les tiles bloquants sur la map (`map-footprint.ts` existe déjà). → [#14](https://github.com/xLeDocteurx/river-king/issues/14)
- [x] **Grid visibility toggle** — Afficher/masquer la grille dans l'éditeur de scène. → [#5](https://github.com/xLeDocteurx/river-king/issues/5)
- [x] **Sprite editor : frame management** — Éditeur multi-frame avec onion-skinning et preview d'animation. → [#15](https://github.com/xLeDocteurx/river-king/issues/15)
- [x] **Folder : suppression** — Bouton de suppression sur l'en-tête d'un groupe vide (scènes et tuiles) pour nettoyer les dossiers inutiles. → [#4](https://github.com/xLeDocteurx/river-king/issues/4)
- [x] **Folder : renommage** — Double-click sur le titre d'un groupe pour renommer le dossier sans tout redéplacer. → [#16](https://github.com/xLeDocteurx/river-king/issues/16)
- [x] **Folders premium folding** — Fermer certains dossiers par défaut quand la liste est longue, pour une navigation plus rapide. → [#17](https://github.com/xLeDocteurx/river-king/issues/17)
- [x] **UI : création de dossier** — Remplacer `window.prompt()` par un petit inline input dans `grouped-list` pour une création de dossier plus propre et cohérente. → [#18](https://github.com/xLeDocteurx/river-king/issues/18)
- [ ] **Sprite editor : grid visibility** — Un bouton de visibilité de la grille de pixels sur l'écran tiles (comme celui de l'éditeur de scène), pour masquer/afficher le quadrillage du pixel canvas. → [#40](https://github.com/xLeDocteurx/river-king/issues/40)
- [ ] **Sprite editor : onion dans un popover** — Remplacer la ligne inline "Onion" par un bouton (icône façon grid visibility) qui ouvre un petit panneau flottant avec les contrôles onion (prev/next + opacités). → [#41](https://github.com/xLeDocteurx/river-king/issues/41)

## Lower Priority

- [x] **Project rename/settings** — Renommer un projet après création. → [#19](https://github.com/xLeDocteurx/river-king/issues/19)
- [x] **Loading states** — Skeleton/spinner pendant les opérations IndexedDB async. → [#20](https://github.com/xLeDocteurx/river-king/issues/20)
- [x] **Guard route projet** — Valider l'existence du projet avant de charger les nested routes. → [#21](https://github.com/xLeDocteurx/river-king/issues/21)
- [x] **Nettoyage des stubs vides** — `core/guards/`, `shared/directives/`, `shared/pipes/` sont des dossiers vides. → [#22](https://github.com/xLeDocteurx/river-king/issues/22)
- [x] **README projet** — Le README est le template Angular CLI par défaut. Le remplacer par une vraie description du projet. → [#6](https://github.com/xLeDocteurx/river-king/issues/6)
- [x] **Responsive/mobile** — Les layouts fixes cassent sur les petits écrans. Ajouter des breakpoints ou panneaux repliables. → [#23](https://github.com/xLeDocteurx/river-king/issues/23)
- [x] **Favicon & branding** — Pas de favicon ni de manifest PWA. → [#24](https://github.com/xLeDocteurx/river-king/issues/24)
- [x] **CI/CD** — Pipeline de lint + test (GitHub Actions ou similaire). → [#25](https://github.com/xLeDocteurx/river-king/issues/25)

## Repository & Branding

- [x] **About du repo + lien live** — L'About GitHub est vide (description, homepage, topics). Le site GitHub Pages est déjà déployé (https://xledocteurx.github.io/river-king/) mais le lien n'apparaît nulle part. Remplir l'About du repo (description punchy, homepage → site Pages, topics découvrables) et ajouter un badge "Live demo" cliquable dans le README. → [#33](https://github.com/xLeDocteurx/river-king/issues/33)
- [x] **Supprimer la branche après merge** — Ne pas polluer le repo avec les branches `feature-*` une fois leur PR mergée. Activer l'option native "auto-delete head branches" + documenter. → [#34](https://github.com/xLeDocteurx/river-king/issues/34)
- [x] **Contenu GitHub en anglais** — Tout le contenu visible sur GitHub (About, README, PR, rapports, issues, commentaires) doit être en anglais. Traduction rétroactive des sections "Design (groomed...)" en français ajoutées aux corps d'issues + commentaires FR. → [#35](https://github.com/xLeDocteurx/river-king/issues/35)

---

## 4 Directions futures (brainstorming 2026-09)

> Session brainstorming — vision : **outil de level design d'abord, puis mini game engine**.
> Choix retenu : **Direction A** (donner vie aux données déjà éditées). Les autres directions restent au backlog d'idées.

### Direction A — Jouer ses scènes (mini game engine)

Le chaînon manquant : le modèle a déjà `blocking` + `interactable` + `actionId` référencés mais **inutilisés**. C'est LE truc qui transforme l'outil en "Engine".

- [ ] **A1. Mode Play** — Toggle Play/Edit dans le scene editor : un player parcourt la map, collisions avec les tiles `blocking`, la caméra suit le personnage. WASD/arrows. 🔴 Lourd — priorité ⭐⭐⭐
- [ ] **A2. Player controller** — Sprite player, animations de marche, les tiles `interactable` déclenchent des actions à l'approche. 🟠 Moyen — ⭐⭐⭐
- [ ] **A3. Interactions réelles** — Donner vie au `actionId` : dialogues, portes/objets, téléport entre scènes, changement de tile. 🟠 Moyen — ⭐⭐
- [ ] **A4. Preview projet** — Bouton "Jouer" global qui lance le player dans la scène active (relié au SessionService). 🟢 Léger — ⭐⭐
- [ ] **A5. Fullscreen/game mode** — Mode plein écran sans chrome UI. 🟢 Léger — ⭐
- [ ] **A6. Rendu "devant/derrière" du player (tri Y, Y-sorting)** — Besoin né du design de #49 : les tiles débordantes (canopée d'arbre, herbe haute, buisson) doivent se rendre devant ou derrière le player selon la position du player sur l'axe Y. Nécessite un attribut tile (ancrage "pied" / marquage "débordant") + un mécanisme de rendu par profondeur. **Player v1 = rendu au-dessus de tout** ; le tri Y est un chantier séparé à part entière (voir US). 🟠 Moyen—Lourd — ⭐⭐⭐

### Direction B — Enrichir le level design

- [ ] **B1. Auto-tile** — Pinceau "terrain" qui choisit corner/edge tiles selon les voisins. 🔴 Lourd — ⭐⭐⭐
- [ ] **B2. Sélection & copier/coller** — Sélection rectangulaire de tiles, copier/couper/coller entre scènes et layers. 🟠 Moyen — ⭐⭐⭐
- [ ] **B3. Outils ligne/oval/fill** — Remplir rectangle/ellipse, tracer une ligne. 🟠 Moyen — ⭐⭐
- [ ] **B4. Bucket fill scène** — Remplissage de zone contiguë au niveau scène multi-layer. 🟢 Léger — ⭐⭐
- [ ] **B5. Tile rotation/miroir** — Appliquer rotations/reflets aux tiles placées. 🟢 Léger — ⭐
- [ ] **B6. Pinceau "stamp" multi-tiles** — Composer un motif et le poser d'un clic. 🟢 Léger — ⭐

### Direction C — Pipeline data → game

- [ ] **C1. Event triggers** — Tile qui déclenche une action quand le player marche dessus. 🟠 Moyen — ⭐⭐
- [ ] **C2. Portails** — Tile "portal" qui téléporte vers une autre scène/position. 🟠 Moyen — ⭐⭐
- [ ] **C3. Export tilemap standard** — Export Tiled/LPC/Godot compatible (pas seulement le JSON interne). 🟠 Moyen — ⭐⭐
- [ ] **C4. Variables d'état par projet** — Switchs/keys/items persistants entre scènes (prépare des quêtes simples). 🔴 Lourd — ⭐

### Direction D — Robustesse & partage

- [ ] **D1. Versioning / autosave** — Historique de versions + autosave périodique. 🟠 Moyen — ⭐⭐⭐
- [ ] **D2. Import d'images** — Importer un PNG comme sprite + détection de tileset. 🟠 Moyen — ⭐⭐⭐
- [ ] **D3. Export atlas/PNG de la map** — Exporter la scène en image PNG. 🟢 Léger — ⭐⭐
- [ ] **D4. Templates de projet** — Nouveau projet pré-rempli (taille, palette, exemple de scène). 🟢 Léger — ⭐
- [ ] **D5. Vrai cloud sync** — Synchro multi-appareils via un service. 🔴 Lourd — ⭐
