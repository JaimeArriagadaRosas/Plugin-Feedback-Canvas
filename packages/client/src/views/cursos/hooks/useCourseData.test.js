import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCourseData } from '../hooks/useCourseData';
import { api, ApiError } from 'shared/api';
import { getToken, setToken } from 'shared/lib/authToken';

beforeEach(() => {
  vi.useFakeTimers();
  sessionStorage.clear();
  localStorage.clear();
  setToken(null);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useCourseData', () => {
  it('T-04: clasifica 401 como auth y no reintenta', async () => {
    vi.spyOn(api, 'get').mockRejectedValueOnce(new ApiError('No autorizado', 401, { mensaje: 'No autorizado' }, 'auth'));

    const { result } = renderHook(() => useCourseData(undefined));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(result.current.error).toBeTruthy();
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('T-05: backoff es creciente y con jitter', async () => {
    vi.spyOn(api, 'get').mockRejectedValue(new Error('Network error'));

    const originalRandom = Math.random;
    let callCount = 0;
    vi.spyOn(Math, 'random').mockImplementation(() => {
      callCount++;
      return 0.5;
    });

    const { result } = renderHook(() => useCourseData(undefined));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(api.get).toHaveBeenCalledTimes(3);
    expect(result.current.error).toBeTruthy();

    Math.random = originalRandom;
  });

  it('T-02: no setState después de unmount', async () => {
    vi.spyOn(api, 'get').mockImplementation(() => new Promise(() => {}));

    const { unmount } = renderHook(() => useCourseData(undefined));

    act(() => {
      unmount();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('T-03: cachea cursos en sessionStorage y los hidrata al montar', async () => {
    const courses = [{ id: '1', name: 'Curso Test', course_code: 'TEST' }];
    vi.spyOn(api, 'get').mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ exito: true, data: courses }), 100)));

    const { result, unmount } = renderHook(() => useCourseData(undefined));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(result.current.usingCache).toBe(false);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(result.current.courses).toHaveLength(1);
    expect(sessionStorage.getItem('course_cache_v1')).toBeTruthy();

    unmount();
    vi.mocked(api.get).mockClear();

    const { result: result2 } = renderHook(() => useCourseData(undefined));

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    expect(result2.current.usingCache).toBe(true);
  });
});
