# Ideas & Backlog

Centralized list of feature ideas, UX improvements, and technical debt for the River King engine.

---

## High Impact

- [ ] **Undo/Redo** — Stack d'actions dans les éditeurs (scene, sprite, tile). Stub existant dans `core/actions/game-actions.ts`.
- [ ] **Export/Import** — Exporter un projet (JSON, tilemap, atlas d'images). Importer un projet existant.
- [ ] **Status bar utile** — Coordonnées curseur, zoom, dimensions scène, nombre de tiles, etc.

## Medium Impact

- [ ] **Keyboard shortcuts** — Ctrl+Z undo, Delete, numéros pour switch d'outil, Ctrl+S save.
- [ ] **Visualisation des collisions/footprints** — Toggle pour voir les tiles bloquants sur la map (`map-footprint.ts` existe déjà).
- [ ] **Grid visibility toggle** — Afficher/masquer la grille dans l'éditeur de scène.
- [ ] **Sprite editor : frame management** — Éditeur multi-frame avec onion-skinning et preview d'animation.
- [ ] **Folder : suppression** — Bouton de suppression sur l'en-tête d'un groupe vide (scènes et tuiles) pour nettoyer les dossiers inutiles.
- [ ] **Folder : renommage** — Double-click sur le titre d'un groupe pour renommer le dossier sans tout redéplacer.
- [ ] **Folders premium folding** — Fermer certains dossiers par défaut quand la liste est longue, pour une navigation plus rapide.
- [ ] **UI : création de dossier** — Remplacer `window.prompt()` par un petit inline input dans `grouped-list` pour une création de dossier plus propre et cohérente.

## Lower Priority

- [ ] **Project rename/settings** — Renommer un projet après création.
- [ ] **Loading states** — Skeleton/spinner pendant les opérations IndexedDB async.
- [ ] **Guard route projet** — Valider l'existence du projet avant de charger les nested routes.
- [ ] **Nettoyage des stubs vides** — `core/guards/`, `shared/directives/`, `shared/pipes/` sont des dossiers vides.
- [ ] **README projet** — Le README est le template Angular CLI par défaut. Le remplacer par une vraie description du projet.
- [ ] **Responsive/mobile** — Les layouts fixes cassent sur les petits écrans. Ajouter des breakpoints ou panneaux repliables.
- [ ] **Favicon & branding** — Pas de favicon ni de manifest PWA.
- [ ] **CI/CD** — Pipeline de lint + test (GitHub Actions ou similaire).
