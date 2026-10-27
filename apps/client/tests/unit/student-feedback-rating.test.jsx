import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useStudentFeedback } from '../../src/views/feedback/hooks/useStudentFeedback.js';

const mockApi = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('@/api', () => ({ api: mockApi }));
vi.mock('../../src/utils/logger', () => ({
  default: { error: vi.fn(), warn: vi.fn() }
}));

const originalFeedback = [{
  id: 'assignment-1',
  name: 'Assignment',
  feedback: { id: 12, calificacion_estudiante: null, es_util: null }
}];
const setup = async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const wrapper = ({ children }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = renderHook(() => useStudentFeedback('7', '1'), { wrapper });
  await waitFor(() => expect(hook.result.current.assignments).toHaveLength(1));
  act(() => hook.result.current.handleSelectAssignment(hook.result.current.assignments[0]));
  return { ...hook, client };
};

describe('student feedback rating UI state', () => {
  beforeEach(() => { mockApi.get.mockReset(); mockApi.post.mockReset(); mockApi.get.mockResolvedValue({ exito:true, data:structuredClone(originalFeedback) }); });
  afterEach(() => vi.restoreAllMocks());

  it('does not show success or change stars until backend confirms', async () => {
    let accept;
    mockApi.post.mockImplementation(() => new Promise(resolve => { accept=resolve; }));
    const { result } = await setup();
    let saving;
    act(() => { saving = result.current.handleRateFeedback(12, 4, null); });
    expect(result.current.ratingSaved).toBe(false);
    expect(result.current.studentRating).toBe(0);
    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1));
    await act(async () => { accept({ exito:true, data:{rating:4,esUtil:null} }); await saving; });
    expect(result.current.ratingSaved).toBe(true);
    expect(result.current.studentRating).toBe(4);
    expect(mockApi.post).toHaveBeenCalledWith('/student/rate',{id:12,rating:4});
  });

  it('reports server failure rather than showing false success', async () => {
    mockApi.post.mockRejectedValue(new Error('HTTP 500'));
    const { result } = await setup();
    await act(async () => { await result.current.handleRateFeedback(12, 2, null); });
    expect(result.current.ratingSaved).toBe(false);
    expect(result.current.studentRating).toBe(0);
    expect(result.current.ratingError).toMatch(/guardar/i);
  });

  it('allows usefulness without stars and preserves false', async () => {
    mockApi.post.mockResolvedValue({ exito:true, data:{rating:null,esUtil:false} });
    const { result } = await setup();
    await act(async () => { await result.current.handleRateFeedback(12, 0, false); });
    expect(mockApi.post).toHaveBeenCalledWith('/student/rate',{id:12,esUtil:false});
    expect(result.current.studentEsUtil).toBe(false);
    expect(result.current.ratingSaved).toBe(true);
  });

  it('prevents repeated concurrent submissions for the same student', async () => {
    let accept;
    mockApi.post.mockImplementation(() => new Promise(resolve => { accept=resolve; }));
    const { result } = await setup();
    let saving;
    act(() => { saving = result.current.handleRateFeedback(12, 3, null); });
    await act(async () => { await result.current.handleRateFeedback(12, 5, null); });
    expect(mockApi.post).toHaveBeenCalledTimes(1);
    await act(async () => { accept({ exito:true, data:{rating:3,esUtil:null} }); await saving; });
    expect(result.current.studentRating).toBe(3);
  });
  it('restores saved stars and usefulness when details are opened again', async () => {
    mockApi.get.mockResolvedValue({ exito:true, data:[{
      ...originalFeedback[0],
      feedback: { ...originalFeedback[0].feedback, calificacion_estudiante:5, es_util:false }
    }] });
    const { result } = await setup();
    expect(result.current.studentRating).toBe(5);
    expect(result.current.studentEsUtil).toBe(false);
    expect(result.current.ratingSaved).toBe(true);
  });

  it('allows a successful retry after a rejected request', async () => {
    mockApi.post.mockRejectedValueOnce(new Error('network lost'))
      .mockResolvedValueOnce({ exito:true, data:{rating:4,esUtil:null} });
    const { result } = await setup();
    await act(async () => { await result.current.handleRateFeedback(12, 4, null); });
    expect(result.current.ratingSaved).toBe(false);
    await act(async () => { await result.current.handleRateFeedback(12, 4, null); });
    expect(result.current.studentRating).toBe(4);
    expect(result.current.ratingSaved).toBe(true);
    expect(result.current.ratingError).toBe('');
  });

});
