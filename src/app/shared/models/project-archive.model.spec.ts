import {
  PROJECT_ARCHIVE_FORMAT,
  PROJECT_ARCHIVE_VERSION,
  type ProjectArchive,
} from './project-archive.model';
import type { TileProperties } from './tile.model';

describe('ProjectArchive model', () => {
  it('exposes the archive format and version constants', () => {
    expect(PROJECT_ARCHIVE_FORMAT).toBe('river-king-project');
    expect(PROJECT_ARCHIVE_VERSION).toBe(1);
  });

  it('describes a complete archive shape', () => {
    const archive: ProjectArchive = {
      format: PROJECT_ARCHIVE_FORMAT,
      formatVersion: PROJECT_ARCHIVE_VERSION,
      exportedAt: 0,
      project: {
        name: 'Heroes',
        palette: ['#ff0000'],
        tileSize: 16,
        mapWidth: 40,
        mapHeight: 30,
      },
      tiles: [
        {
          sourceId: 1,
          name: 'Ground',
          type: 'static',
          spriteIds: [1],
          animationSpeed: 4,
          properties: { blocking: false, interactable: false } satisfies TileProperties,
          folderPath: '',
        },
      ],
      sprites: [
        {
          sourceId: 1,
          tileSourceId: 1,
          name: 'frame 1',
          width: 16,
          height: 16,
          pixelData: 'data:image/png;base64,AAA',
        },
      ],
      scenes: [
        {
          name: 'Level 1',
          folderPath: '',
          width: 10,
          height: 10,
          layers: [
            {
              id: 'l-1',
              name: 'Background',
              visible: true,
              opacity: 1,
              tileData: [[1, -1]],
            },
          ],
        },
      ],
      folders: ['nature'],
    };
    expect(archive.project.name).toBe('Heroes');
  });
});