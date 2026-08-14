import { AppError } from '../../utils/errors.js';
import { FEEDBACK_STATES } from '@plugin-feedback/contracts';

export class FeedbackStateMachine {
  static STATES = FEEDBACK_STATES;

  static validateCanApprove(currentState) {
    if (currentState === this.STATES.APPROVED || currentState === this.STATES.SENT) {
      throw new AppError('This feedback has already been approved and sent previously.', 400);
    }
  }

  static validateCanEdit(currentState) {
    if (currentState === this.STATES.SENT) {
      throw new AppError('You cannot edit a feedback that has already been sent.', 400);
    }
  }
}
