import { AppError } from '../../utils/errors.js';

export class FeedbackStateMachine {
  static STATES = {
    PENDING: 'PENDIENTE',
    EDITED: 'EDITADO',
    APPROVED: 'APROBADO',
    SENT: 'ENVIADO'
  };

  static validateCanApprove(currentState) {
    if (currentState === this.STATES.APPROVED || currentState === this.STATES.SENT) {
      throw new AppError('Este feedback ya ha sido aprobado y enviado previamente.', 400);
    }
  }

  static validateCanEdit(currentState) {
    if (currentState === this.STATES.SENT) {
      throw new AppError('No se puede editar un feedback que ya ha sido enviado.', 400);
    }
  }
}
