/**
 * Capture how startup mode was selected BEFORE main.js sets NON_INTERACTIVE=true.
 * That flag suppresses unattended startup prompts but is set internally even
 * after a human has already selected mode 3.
 */
export function modeWasSelectedInteractively({
  requestedMode, nonInteractive = process.env.NON_INTERACTIVE,
  stdinIsTTY = process.stdin.isTTY
} = {}) {
  return !requestedMode && nonInteractive !== 'true' && stdinIsTTY === true;
}
