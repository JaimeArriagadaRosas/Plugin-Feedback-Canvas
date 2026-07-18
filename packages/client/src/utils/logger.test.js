import { describe, it, expect, vi } from 'vitest';
import logger from '../utils/logger';

describe('logger', () => {
  it('should have debug, info, warn, error methods', () => {
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('should call console methods', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.debug('Test', 'message');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
