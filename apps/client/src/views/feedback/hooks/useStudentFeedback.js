import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
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

  const [studentEsUtil, setStudentEsUtil] = useState(null);

  const rateMutation = useMutation({
    mutationFn: async ({ feedbackId, rating, esUtil }) => {
      const result = await api.post('/student/rate', { id: feedbackId, rating, esUtil });
      if (!result.exito) throw new Error(result.mensaje || 'Error saving rating');
      return result;
    },
    onMutate: async ({ feedbackId, rating, esUtil }) => {
      const prevRating = studentRating;
      const prevEsUtil = studentEsUtil;
      setStudentRating(rating);
      setStudentEsUtil(esUtil);
      await queryClient.cancelQueries({ queryKey: ['student-feedback', studentId, courseId] });
      const previous = queryClient.getQueryData(['student-feedback', studentId, courseId]);
      queryClient.setQueryData(['student-feedback', studentId, courseId], (old = []) =>
        old.map(a => {
          if (a.feedback && a.feedback.id === feedbackId) {
            return { ...a, feedback: { ...a.feedback, calificacion_estudiante: rating, es_util: esUtil } };
          }
          return a;
        })
      );
      setRatingSaved(true);
      return { previous, prevRating, prevEsUtil };
    },
    onError: (err, _, context) => {
      if (context?.prevRating !== undefined) {
        setStudentRating(context.prevRating);
      }
      if (context?.prevEsUtil !== undefined) {
        setStudentEsUtil(context.prevEsUtil);
      }
      if (context?.previous) {
        queryClient.setQueryData(['student-feedback', studentId, courseId], context.previous);
      }
      logger.error('StudentFeedback', 'Error saving rating', { error: err });
    },
  });

  const handleSelectAssignment = useCallback((a) => {
    setSelectedFeedback(a);
    setStudentRating(a.feedback?.calificacion_estudiante || 0);
    setStudentEsUtil(a.feedback?.es_util !== undefined ? a.feedback?.es_util : null);
    setRatingSaved(!!a.feedback?.calificacion_estudiante || a.feedback?.es_util !== null && a.feedback?.es_util !== undefined);
    setViewMode('details');
  }, []);

  const handleRateFeedback = useCallback((feedbackId, rating, esUtil) => {
    rateMutation.mutate({ feedbackId, rating, esUtil });
  }, [rateMutation]);

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
