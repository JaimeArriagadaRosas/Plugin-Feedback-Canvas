import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useButtonLogger } from './useButtonLogger';
import { AuthProvider } from '../views/context/AuthContext';
import { BrowserRouter } from 'react-router-dom';

const wrapper = ({ children }) => (
  <BrowserRouter>
    <AuthProvider>{children}</AuthProvider>
  </BrowserRouter>
);

describe('useButtonLogger', () => {
  it('should return a logging wrapper', () => {
    const { result } = renderHook(() => useButtonLogger(), { wrapper });
    expect(typeof result.current).toBe('function');
  });

  it('should wrap onClick and call logger', () => {
    const { result } = renderHook(() => useButtonLogger(), { wrapper });
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const handler = result.current('TEST_ACTION', () => {});
    act(() => {
      handler({ preventDefault: () => {} });
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
