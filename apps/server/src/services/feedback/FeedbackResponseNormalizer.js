import { DomainError } from '../../utils/errors.js';
export default class FeedbackResponseNormalizer {
  normalize(value) {
    if (typeof value !== 'string' || value.trim().length < 35 || value.includes('[MODO LOCAL')) {
      throw new DomainError('Respuesta de IA no verificable o demasiado corta', 502, 'EMPTY_QUALITATIVE_FEEDBACK');
    }
    return value.trim();
  }
}
