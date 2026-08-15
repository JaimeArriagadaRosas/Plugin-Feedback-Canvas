import { useState, useCallback, useEffect } from 'react';
import sanitizeHtml from 'sanitize-html';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import { assignmentKeys } from '@/lib/queryKeys';
import logger from '../../../utils/logger';

export function useSpeedGraderData() {
  const { courseId } = useParams();
  const queryClient = useQueryClient();
  const [currentAssignmentId, setCurrentAssignmentId] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [grade, setGrade] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [generatedFeedbackId, setGeneratedFeedbackId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("Loading data from Canvas...");

  const { data: meData } = useQuery({
    queryKey: ['config', 'me'],
    queryFn: async () => {
      const result = await api.get('/config/me');
      if (result.exito) return result;
      throw new Error(result.mensaje || 'Error loading config');
    },
  });

  const isAiServiceAvailable = meData?.isAiServiceAvailable ?? true;

  const { data: assignments = [], isFetching: isAssignmentsLoading } = useQuery({
    queryKey: assignmentKeys.speedgrader(courseId),
    queryFn: async () => {
      if (!courseId) return [];
      const result = await api.get(`/courses/${courseId}/assignments`);
      if (result.exito && result.data) {
        return result.data
          .filter(a => Boolean(a.active) === true)
          .map(a => ({
            id: a.id,
            name: a.name,
            points: a.points_possible,
            templateId: a.template || "",
            templateName: a.templateName || "",
            rubric: Array.isArray(a.rubric) ? a.rubric : [],
            hasRubric: a.use_rubric_for_grading === true || a.has_rubric === true || !!(Array.isArray(a.rubric) && a.rubric.length > 0),
            active: Boolean(a.active)
          }));
      }
      return [];
    },

    enabled: !!courseId,
  });

  // Initialize or auto-correct the selected assignment (Watchdog SRP)
  useEffect(() => {
    if (assignments.length === 0) {
      if (currentAssignmentId !== null) setCurrentAssignmentId(null);
      return;
    }
    
    if (!currentAssignmentId) {
      setCurrentAssignmentId(assignments[0].id);
      return;
    }
    
    // If there is an ID but it no longer exists in the active assignment list, force correction
    const isStillValid = assignments.some(a => a.id === currentAssignmentId);
    if (!isStillValid) {
      setCurrentAssignmentId(assignments[0].id);
    }
  }, [assignments, currentAssignmentId]);

  const { data: students = [] } = useQuery({
    queryKey: ['students', courseId],
    queryFn: async () => {
      if (!courseId) return [];
      const result = await api.get(`/courses/${courseId}/students`);
      if (result.exito && result.data) {
        return result.data.map(s => ({ id: s.id, name: s.name || s.short_name }));
      }
      return [];
    },
    enabled: !!courseId,
  });

  const currentStudent = students[currentIndex] || { id: 0, name: "No Student" };

  const { data: submissionData, error: submissionError, isFetching: isFetchingSubmissionQuery, isPending: isSubmissionPending } = useQuery({
    queryKey: ['submission', courseId, currentAssignmentId, currentStudent.id],
    queryFn: async () => {
      if (!courseId || !currentAssignmentId || !currentStudent.id) return null;
      // We use quiz-details because it returns the submission and, if it is a quiz, the questions
      const result = await api.get(`/courses/${courseId}/assignments/${currentAssignmentId}/quiz-details/${currentStudent.id}`);
      if (result.exito && result.data) {
        return result.data; // { submission, questions, latestAttempt }
      }
      return null;
    },
    enabled: !!courseId && !!currentAssignmentId && !!currentStudent.id && students.length > 0 && isAiServiceAvailable,
  });

  const isFetchingSubmission = isAiServiceAvailable 
    ? (isFetchingSubmissionQuery || isSubmissionPending) 
    : false;

  // Clear state when the assignment or student changes
  useEffect(() => {
    setGrade(0);
    setStatusMsg("Loading data from Canvas...");
    setFeedback("");
    setGeneratedFeedbackId(null);
  }, [currentAssignmentId, currentStudent.id]);

  const { data: feedbackDetailList } = useQuery({
    queryKey: ['feedbackDetail', courseId, currentStudent.id],
    queryFn: async () => {
      if (!courseId || !currentStudent.id) return null;
      const result = await api.get(`/feedback/detail?studentId=${currentStudent.id}&courseId=${courseId}`);
      if (result.exito && result.data && Array.isArray(result.data)) {
        return result.data;
      }
      return null;
    },
    enabled: !!courseId && !!currentStudent.id,
    refetchInterval: 15000, // Polling every 15 seconds to update background generated feedback
  });

  const feedbackDetail = feedbackDetailList?.find(fb => fb.assignmentId == currentAssignmentId) || null;

  const submission = submissionData?.submission || null;
  const quizDetails = submissionData ? {
    questions: submissionData.questions || [],
    latestAttempt: submissionData.latestAttempt || null
  } : null;

  useEffect(() => {
    if (!isAiServiceAvailable) {
      setGrade(0);
      setStatusMsg("Read-only mode. AI API inactive.");
      return;
    }
    
    if (submission) {
      const body = submission.body || submission.preview_url || "No submission content.";
      queryClient.setQueryData(['submissions', courseId, currentAssignmentId], (old = {}) => ({
        ...old,
        [currentStudent.id]: sanitizeHtml(body, { allowedTags: [], allowedAttributes: {} })
      }));
      setGrade(submission.score || 0);
      setStatusMsg("Ready to generate feedback.");
    }
  }, [submission, courseId, currentAssignmentId, currentStudent.id, queryClient, isAiServiceAvailable]);

  // If there is pending feedback in the database for this student/assignment, inject it
  useEffect(() => {
    if (feedbackDetail) {
      setFeedback(feedbackDetail.feedback || "");
      setGeneratedFeedbackId(feedbackDetail.id);
    } else {
      setFeedback("");
      setGeneratedFeedbackId(null);
    }
  }, [feedbackDetail, currentAssignmentId, currentStudent.id]);

  useEffect(() => {
    if (submissionError) {
      logger.error('SpeedGrader', "Error loading submission", { error: submissionError });
      setStatusMsg("Error loading submission.");
    }
  }, [submissionError]);

  const isFeedbackApproved = feedbackDetail?.status === 'APROBADO';
  const activeAssignment = assignments.find(a => a.id === currentAssignmentId) || assignments[0] || { name: "", points: null };

  return {
    courseId,
    assignments,
    students,
    currentAssignmentId,
    setCurrentAssignmentId,
    currentIndex,
    setCurrentIndex,
    grade,
    setGrade,
    loading,
    setLoading,
    statusMsg,
    setStatusMsg,
    currentStudent,
    submission,
    quizDetails,
    activeAssignment,
    feedback,
    setFeedback,
    generatedFeedbackId,
    setGeneratedFeedbackId,
    isFeedbackApproved,
    isFetchingSubmission,
    isAssignmentsLoading,
    isAiServiceAvailable,
  };
}
