export interface Session {
  projectId: string;
  lastSceneId: string | null;
  cameraX: number;
  cameraY: number;
  cameraZoom: number;
}
