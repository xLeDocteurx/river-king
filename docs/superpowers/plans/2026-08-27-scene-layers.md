# Scene Layers Implementation Plan

**Goal:** Replace single `tileData` grid with free N-layer system in the scene editor.

## Data Model

```typescript
interface Layer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number; // 0-1
  tileData: number[][];
}

interface Scene {
  // ... existing fields ...
  layers: Layer[]; // replaces tileData
}
```

## Task 1: Update Scene model and add Layer interface

**Files:** `scene.model.ts`

- Add `Layer` interface
- Add `layers: Layer[]` to `Scene`
- Keep `tileData` temporarily for backward compat during migration

## Task 2: Database migration v3 → v4

**Files:** `database.service.ts`

- Add `version(4)` with migration
- Convert existing `tileData` to `layers: [{ id: uuid, name: 'Background', visible: true, opacity: 1, tileData }]`
- Remove `tileData` from schema

## Task 3: Update SceneService for layers

**Files:** `scene.service.ts`

- `createScene()` creates with default "Background" layer
- `updateScene()` handles layer updates

## Task 4: Create LayerPanelComponent

**Files:** NEW `layer-panel/layer-panel.component.ts`, `.html`, `.scss`

- List of layers with name (editable), visibility toggle, opacity slider
- Add/delete/reorder layers
- Active layer highlight
- Design system compliant UI

## Task 5: Update SceneEditorComponent for layers

**Files:** `scene-editor.component.ts`, `.html`

- `activeLayerId` signal
- CRUD methods for layers
- `onTilePlaced` targets active layer
- Import and place LayerPanelComponent in right sidebar

## Task 6: Update MapCanvasComponent for multi-layer rendering

**Files:** `map-canvas.component.ts`, `.html`

- Input `layers` replaces direct `scene.tileData` reading
- Render loop iterates visible layers with opacity
- Placement targets active layer

## Task 7: Update Minimap for multi-layer rendering

**Files:** `scene-minimap.component.ts`

- Render all visible layers at reduced scale

## Task 8: Update undo system for layers

**Files:** `scene-editor.component.ts`

- Undo/redo operates on the correct layer's tileData
