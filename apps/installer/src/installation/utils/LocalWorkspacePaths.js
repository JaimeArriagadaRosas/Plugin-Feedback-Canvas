import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

export function getPluginDirectory() {
  return path.resolve(moduleDirectory, '../../../../..');
}

export function getCanvasDirectory(environment = process.env) {
  if (environment.CANVAS_LMS_DIR) return path.resolve(environment.CANVAS_LMS_DIR);
  return path.resolve(getPluginDirectory(), '..', 'canvas-lms-master');
}
