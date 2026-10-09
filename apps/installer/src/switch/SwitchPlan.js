export function buildPlan({ git, workspace, docker }) {
  return {
    destination: git.destination,
    cleanup: {
      dist: workspace.dist,
      viteCache: workspace.viteCache,
      dockerStop: docker.available && docker.projects.some(p => p.name !== 'canvas' && p.count > 0)
    },
    dependencies: git.lockfileChanged || !workspace.dependencies,
    canvas: {
      preserveClone: true,
      preserveVolumes: true,
      sourceLocaleMayPersist: workspace.setupComplete && workspace.canvasExists
    }
  };
}
