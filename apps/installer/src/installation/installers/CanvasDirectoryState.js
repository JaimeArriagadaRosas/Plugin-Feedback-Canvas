export function getCanvasDirectoryState({ targetExists, composeExists }) {
  if (composeExists) return 'ready';
  if (targetExists) return 'unsafe-existing-directory';
  return 'missing';
}
