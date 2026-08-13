const GIB = 1024 ** 3;

export function getCanvasResourceLimits(memoryBytes) {
  const memoryGb = Number.isFinite(memoryBytes) ? memoryBytes / GIB : null;
  if (memoryGb !== null && memoryGb >= 12) return { web: '8G', jobs: '2G', memoryGb };
  if (memoryGb !== null && memoryGb >= 8) return { web: '5G', jobs: '2G', memoryGb };
  if (memoryGb !== null && memoryGb >= 6) return { web: '4G', jobs: '1G', memoryGb };
  return { web: '3G', jobs: '1G', memoryGb };
}
