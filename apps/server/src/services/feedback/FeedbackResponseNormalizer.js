import { DomainError } from '../../utils/errors.js';
export default class FeedbackResponseNormalizer {
  normalize(value) {
    if (typeof value !== 'string' || value.trim().length < 35 || value.includes('[LOCAL MODE')) {
      throw new DomainError('AI response is unverifiable or too short', 502, 'EMPTY_QUALITATIVE_FEEDBACK');
    }
    return value.trim();
  }
}
