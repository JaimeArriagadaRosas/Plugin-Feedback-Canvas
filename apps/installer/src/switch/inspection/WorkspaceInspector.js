import fs from 'node:fs';
import path from 'node:path';
export function inspectWorkspace(root) {
  const canvas = process.env.CANVAS_LMS_DIR ? path.resolve(process.env.CANVAS_LMS_DIR) : path.resolve(root, '..', 'canvas-lms-master');
  const exists = p => fs.existsSync(p);
  return {
    root, canvas,
    setupComplete: exists(path.join(root, '.setup_complete')),
    canvasExists: exists(canvas),
    canvasAssets: exists(path.join(canvas, '.assets_built')),
    canvasCompose: exists(path.join(canvas, 'docker-compose.yml')),
    dist: exists(path.join(root, 'dist')),
    viteCache: exists(path.join(root, 'node_modules', '.vite')),
    dependencies: exists(path.join(root, 'node_modules')),
    environment: exists(path.join(root, '.env'))
  };
}
