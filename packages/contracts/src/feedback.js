import { z } from 'zod';

export const FEEDBACK_STATES = Object.freeze({
  PENDING: 'PENDIENTE',
  EDITED: 'EDITADO',
  APPROVED: 'APROBADO',
  SENT: 'ENVIADO',
  REJECTED: 'RECHAZADO',
});

export const FEEDBACK_STATE_VALUES = Object.freeze(Object.values(FEEDBACK_STATES));
export const feedbackStateSchema = z.enum(FEEDBACK_STATE_VALUES);

export function isReviewableFeedbackState(state) {
  return state === FEEDBACK_STATES.PENDING || state === FEEDBACK_STATES.EDITED;
}

export function isFinalFeedbackState(state) {
  return state === FEEDBACK_STATES.APPROVED || state === FEEDBACK_STATES.SENT;
}
