import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from 'shared/api';
import logger from '../../../utils/logger';

export function useStudentFeedback(initialStudentId = 1, courseId) {
  const queryClient = useQueryClient();
  const [studentRating, setStudentRating] = useState(0);
  const [ratingSaved, setRatingSaved] = useState(false);
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

  const rateMutation = useMutation({
    mutationFn: async ({ feedbackId, rating }) => {
      const result = await api.post('/student/rate', { id: feedbackId, rating });
      if (!result.exito) throw new Error(result.mensaje || 'Error saving rating');
      return result;
    },
    onMutate: async ({ feedbackId, rating }) => {
      setStudentRating(rating);
      await queryClient.cancelQueries({ queryKey: ['student-feedback', studentId] });
      const previous = queryClient.getQueryData(['student-feedback', studentId]);
      queryClient.setQueryData(['student-feedback', studentId], (old = []) =>
        old.map(a => {
          if (a.id === feedbackId && a.feedback) {
            return { ...a, feedback: { ...a.feedback, calificacion_estudiante: rating } };
          }
          return a;
        })
      );
      setRatingSaved(true);
      return { previous };
    },
    onError: (err, _, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['student-feedback', studentId], context.previous);
      }
      logger.error('StudentFeedback', 'Error saving rating', { error: err });
    },
  });

  const handleSelectAssignment = useCallback((a) => {
    setSelectedFeedback(a);
    setStudentRating(a.feedback?.calificacion_estudiante || 0);
    setRatingSaved(!!a.feedback?.calificacion_estudiante);
    setViewMode('details');
  }, []);

  const handleRateFeedback = useCallback((feedbackId, rating) => {
    if (ratingSaved) return;
    rateMutation.mutate({ feedbackId, rating });
  }, [ratingSaved, rateMutation]);

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
    ratingSaved,
    setViewMode,
    setSelectedFeedback,
    setStudentRating,
    setRatingSaved,
    handleSelectAssignment,
    handleRateFeedback,
    handleBackToList,
  };
}
