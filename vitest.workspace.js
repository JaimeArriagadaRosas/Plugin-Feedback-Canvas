import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'apps/client',
  'apps/installer',
  'apps/server',
  'packages/*'
]);
