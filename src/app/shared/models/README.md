## Models

Interfaces, types, enums et DTOs partagés.

## Conventions

- Un fichier par entité majeure.
- Préférer les `interface` aux `class` pour les modèles de données.
- Exporter les enums en `const enum` quand c'est possible.

## Domain Models

- `Project` — Game project metadata and configuration
- `Scene` — Individual game level/scene with tile grid
- `Tile` — Tile definitions with properties and animation settings
- `Sprite` — Pixel art data for tile graphics
- `Session` — Per-project user session state (camera, selected scene)
