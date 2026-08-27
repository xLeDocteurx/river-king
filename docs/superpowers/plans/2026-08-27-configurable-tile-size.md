# Configurable Tile Size Implementation Plan

**Goal:** Allow users to choose tile size (8, 16, or 32 pixels) when creating a project.

**Architecture:** Project model already has `tileSize` field. All downstream code reads it. Only the create dialog hardcodes 16, and SpriteService.createSprite() hardcodes 16x16.

## Task 1: Add tile size selector to create dialog

**Files:** `project-create-dialog.component.ts`, `.html`, `.spec.ts`

- Add `selectedTileSize = signal(16)` and `tileSizes = [8, 16, 32]`
- Add radio button UI between Name and Palette fields
- Use `selectedTileSize()` in `createProject()` instead of hardcoded 16
- Reset in `open()`
- Test: verify non-default tileSize passed to service

## Task 2: Make SpriteService.createSprite accept custom dimensions

**Files:** `sprite.service.ts`

- Add optional `width = 16, height = 16` params
- Generate blank PNG dynamically using `encodePixelData(blankIndices(w,h), [])`
- Remove static `BLANK_PIXEL_DATA`

## Task 3: Pass project tileSize to sprite creation

**Files:** `sprite-editor.component.ts`

- Add `projectTileSize` signal, load from project in `loadProjectPalette()`
- Pass to `createSprite()` in `onAddFrame()`
- Duplicate preserves original dimensions in `onDuplicateFrame()`
