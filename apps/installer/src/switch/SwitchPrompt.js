import { askConfirm } from '../orchestration/cli.js';
import { boot } from '../orchestration/boot/logger.js';
export async function confirmAction({ title, detail, risk = 'low' }) {
  boot.plain('');
  boot.info(title);
  if (detail) boot.info(detail);
  if (risk === 'high') boot.warn('Sensitive operation. Explicit approval is required to continue.');
  return askConfirm('Do you approve this operation?', false);
}
