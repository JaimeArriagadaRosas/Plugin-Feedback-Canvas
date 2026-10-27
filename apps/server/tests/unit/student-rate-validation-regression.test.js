import { describe, it, expect } from 'vitest';
import { schemas } from '../../src/security/validation.js';

describe('student rate requests', () => {
  it.each([1, 2, 3, 4, 5])('accepts valid star %i', rating => {
    expect(schemas.studentRate.safeParse({ id: 1, rating }).success).toBe(true);
  });
  it.each([true, false])('accepts usefulness %s without stars', esUtil => {
    expect(schemas.studentRate.safeParse({ id: 1, esUtil }).success).toBe(true);
  });
  it.each([0, -1, 6, 1.5, '5', null])('rejects invalid star %s', rating => {
    expect(schemas.studentRate.safeParse({ id: 1, rating }).success).toBe(false);
  });
  it('rejects empty rating and extra fields', () => {
    expect(schemas.studentRate.safeParse({ id: 1 }).success).toBe(false);
    expect(schemas.studentRate.safeParse({ id: 1, esUtil: true, admin: true }).success).toBe(false);
  });
});
