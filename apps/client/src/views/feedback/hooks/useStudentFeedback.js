import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import logger from '../../../utils/logger';

export function useStudentFeedback(initialStudentId = 1, courseId) {
  const queryClient = useQueryClient();
  const [studentRating, setStudentRating] = useState(0);
  const [ratingSaved, setRatingSaved] = useState(false);
  const [ratingError, setRatingError] = useState('');
  const ratingInFlight = useRef(false);
  const [viewMode, setViewMode] = useState('list');
  const [selectedFeedback, setSelectedFeedback] = useState(null);
  const [studentId, setStudentId] = useState(initialStudentId);

  const { data: assignments = [], isLoading: loading } = useQuery({
    queryKey: ['student-feedback', studentId, courseId],
    queryFn: async () => {
      const url = courseId ? `/student/feedback/${studentId}?courseId=${courseId}` : `/student/feedback/${studentId}`;
      const result = await api.get(url);
      if (result.exito && result.data) {
        return result.data;
      }
      return [];
    },
    enabled: !!studentId,
  });

  const [studentEsUtil, setStudentEsUtil] = useState(null);

  const rateMutation = useMutation({
    mutationFn: async ({ feedbackId, rating, esUtil }) => {
      const payload = { id: feedbackId };
      if (rating !== undefined) payload.rating = rating;
      if (esUtil !== undefined) payload.esUtil = esUtil;
      const result = await api.post('/student/rate', payload);
      if (!result?.exito) throw new Error(result?.mensaje || 'Error saving rating');
      return result;
    },
  });

  const handleSelectAssignment = useCallback((a) => {
    setSelectedFeedback(a);
    setRatingError('');
    setStudentRating(a.feedback?.calificacion_estudiante || 0);
    setStudentEsUtil(a.feedback?.es_util !== undefined ? a.feedback?.es_util : null);
    setRatingSaved(!!a.feedback?.calificacion_estudiante || a.feedback?.es_util !== null && a.feedback?.es_util !== undefined);
    setViewMode('details');
  }, []);

  const handleRateFeedback = useCallback(async (feedbackId, rating, esUtil) => {
    if (ratingInFlight.current) return false;
    ratingInFlight.current = true;
    setRatingSaved(false);
    setRatingError('');
    try {
      const response = await rateMutation.mutateAsync({
        feedbackId,
        rating: Number.isInteger(rating) && rating >= 1 ? rating : undefined,
        esUtil: typeof esUtil === 'boolean' ? esUtil : undefined,
      });
      const nextRating = response.data?.rating ?? studentRating;
      const nextEsUtil = response.data?.esUtil ?? studentEsUtil;
      setStudentRating(nextRating || 0);
      setStudentEsUtil(nextEsUtil);
      const key = ['student-feedback', studentId, courseId];
      queryClient.setQueryData(key, (old = []) => old.map(a =>
        String(a.feedback?.id) === String(feedbackId)
          ? { ...a, feedback: { ...a.feedback, calificacion_estudiante: nextRating, es_util: nextEsUtil } }
          : a
      ));
      setSelectedFeedback(old => old && String(old.feedback?.id) === String(feedbackId)
        ? { ...old, feedback: { ...old.feedback, calificacion_estudiante: nextRating, es_util: nextEsUtil } }
        : old);
      setRatingSaved(true);
      return true;
    } catch (error) {
      logger.error('StudentFeedback', 'Error saving rating', { error });
      setRatingError('No se pudo guardar la valoración. Intenta nuevamente.');
      setRatingSaved(false);
      await queryClient.invalidateQueries({ queryKey: ['student-feedback', studentId, courseId] });
      return false;
    } finally {
      ratingInFlight.current = false;
    }
  }, [rateMutation, studentRating, studentEsUtil, studentId, courseId, queryClient]);

  const handleBackToList = useCallback(() => {
    setViewMode('list');
    setSelectedFeedback(null);
  }, []);

  return {
    assignments,
    loading,
    viewMode,
    selectedFeedback,
    studentRating,
    studentEsUtil,
    ratingSaved,
    ratingError,
    ratingPending: rateMutation.isPending,
    setViewMode,
    setSelectedFeedback,
    setStudentRating,
    setStudentEsUtil,
    setRatingSaved,
    handleSelectAssignment,
    handleRateFeedback,
    handleBackToList,
  };
}
