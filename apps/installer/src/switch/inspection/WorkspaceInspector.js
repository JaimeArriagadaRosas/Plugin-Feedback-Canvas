import fs from 'node:fs';
import path from 'node:path';
export function inspectWorkspace(root) {
  const canvas = process.env.CANVAS_LMS_DIR ? path.resolve(process.env.CANVAS_LMS_DIR) : path.resolve(root, '..', 'canvas-lms-master');
  const exists = p => fs.existsSync(p);
  return { root, canvas, canvasExists: exists(path.join(canvas, 'docker-compose.yml')),
    setupComplete: exists(path.join(root, '.setup_complete')),
    canvasAssets: exists(path.join(canvas, '.assets_built')),
    dist: exists(path.join(root, 'dist')),
    viteCache: exists(path.join(root, 'node_modules', '.vite')),
    profiles: exists(path.join(root, 'tmp', 'canvas_local_users.json')),
    canvasProfiles: exists(path.join(canvas, 'tmp', 'perfiles_data.json')),
    dependencies: exists(path.join(root, 'node_modules')),
    environment: exists(path.join(root, '.env'))
  };
}
