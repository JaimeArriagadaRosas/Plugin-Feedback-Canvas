export function buildPlan({ git, workspace, docker }) {
  return {
    destination: git.destination,
    cleanup: {
      dist: workspace.dist, viteCache: workspace.viteCache,
      setupMarker: workspace.setupComplete, assetsMarker: workspace.canvasAssets,
      profiles: workspace.profiles, canvasProfiles: workspace.canvasProfiles
    },
    projects: docker.projects || [],
    dependencies: git.lockfileChanged || !workspace.dependencies,
    canvas: { exists: workspace.canvasExists, preserveClone: true, targetLocale: 'en' }
  };
}
