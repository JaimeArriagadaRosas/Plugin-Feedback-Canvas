// ENVIADO is already approved and delivered; preserve the state while counting approval.
export const approvedFeedbackStates = new Set(['APROBADO', 'ENVIADO']);
export const isApprovedFeedback = state => approvedFeedbackStates.has(state);
export const normalizeFeedbackStatus = state => state || 'PENDIENTE';
