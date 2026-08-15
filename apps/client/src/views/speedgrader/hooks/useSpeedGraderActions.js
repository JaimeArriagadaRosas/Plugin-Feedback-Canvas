import { useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import logger from '../../../utils/logger';

export function useSpeedGraderActions({
  courseId,
  currentAssignmentId,
  currentStudent,
  students = [],
  assignments = [],
  grade,
  feedback,
  generatedFeedbackId,
  setLoading,
  setStatusMsg,
  setFeedback,
  setGeneratedFeedbackId,
  activeAssignment,
  onExit,
  logExit,
  setIsManualMode,
  isAssignmentsLoading
}) {
  const queryClient = useQueryClient();
  const currentStudentRef = useRef(currentStudent?.id);

  useEffect(() => {
    currentStudentRef.current = currentStudent?.id;
  }, [currentStudent?.id]);

  const handleGenerateMassive = useCallback(async (isRegenerate = false) => {
    if (isAssignmentsLoading) {
      alert("Please wait for all assignments to finish loading before generating mass feedback.");
      return;
    }

    setLoading(true);
    setStatusMsg(isRegenerate ? "Mass generating and regenerating..." : "Mass generating...");
    
    const targetStudentId = currentStudent?.id;
    
    try {
      const activeAssignments = assignments.filter(a => a.active);
      const otherStudents = students.filter(s => s.id !== targetStudentId);
      const otherAssignments = activeAssignments.filter(a => a.id !== currentAssignmentId);

      // 1. Trigger mass generation in background for OTHER students (across all assignments)
      if (otherStudents.length > 0) {
        api.post('/feedback/generate-all', {
          courseId,
          activeAssignments,
          students: otherStudents,
          isRegenerate
        }).catch(err => logger.error('SpeedGrader', "Error in background generate-all others", { err }));
      }

      // 2. Trigger mass generation in background for CURRENT STUDENT (across other assignments)
      if (otherAssignments.length > 0 && targetStudentId) {
        api.post('/feedback/generate-all', {
          courseId,
          activeAssignments: otherAssignments,
          students: [{ id: targetStudentId }],
          isRegenerate
        }).catch(err => logger.error('SpeedGrader', "Error in background generate-all current student", { err }));
      }

      // 3. Generate synchronously for the current student in the current assignment, allowing error capture and displaying 'Generating...' status
      const result = await api.post('/feedback/generate', {
        courseId,
        assignmentId: currentAssignmentId,
        studentId: targetStudentId,
        templateId: activeAssignment?.templateId || 1,
        isRegenerate
      });

      // Only update the UI if we haven't changed students while loading
      if (currentStudentRef.current === targetStudentId) {
        if (result.exito && result.data) {
          setFeedback(result.data.content);
          setGeneratedFeedbackId(result.data.id);
          setStatusMsg(isRegenerate ? "Regeneration successful. Mass process continues." : "Generation successful. Mass process continues.");
        } else if (result.omitido) {
          setStatusMsg("Current student skipped (already has feedback or not applicable).");
        }
      }
      
      queryClient.invalidateQueries({ queryKey: ['feedbackDetail', courseId] });
      queryClient.invalidateQueries({ queryKey: ['pending-summary'] });
      queryClient.invalidateQueries({ queryKey: ['feedback-list'] });
    } catch (error) {
      logger.error('SpeedGrader', "Critical error generating feedback", { error });
      if (currentStudentRef.current === targetStudentId) {
        // Send the error directly to the review box
        setFeedback(`[ERROR] ${error.message || "Error contacting AI"}`);
        setStatusMsg("Error generating.");
      }
    } finally {
      if (currentStudentRef.current === targetStudentId) {
        setLoading(false);
      }
    }
  }, [assignments, courseId, students, currentAssignmentId, currentStudent, activeAssignment, setLoading, setStatusMsg, setFeedback, setGeneratedFeedbackId, queryClient, isAssignmentsLoading]);

  const handleApprove = useCallback(async (rating) => {
    if (!generatedFeedbackId) return;
    setLoading(true);
    setStatusMsg("Saving and sending feedback and grade...");
    try {
      const result = await api.post('/feedback/approve', {
        feedbackId: generatedFeedbackId,
        courseId: courseId,
        assignmentId: currentAssignmentId,
        studentId: currentStudent.id,
        content: feedback,
        grade: grade,
        rating: rating,
      });
      if (!result.exito) throw new Error("Error approving feedback");
      setStatusMsg("Successfully sent to Canvas!");
      queryClient.invalidateQueries({ queryKey: ['feedbackDetail', courseId, currentStudent.id] });
      queryClient.invalidateQueries({ queryKey: ['pending-summary'] });
      queryClient.invalidateQueries({ queryKey: ['feedback-list'] });
    } catch (e) {
      logger.error('SpeedGrader', "Error sending feedback", { error: e });
      setStatusMsg("Error sending.");
    } finally {
      setLoading(false);
    }
  }, [generatedFeedbackId, currentAssignmentId, currentStudent, feedback, grade, courseId, setGeneratedFeedbackId, setLoading, setStatusMsg, queryClient]);

  const handleManualSubmit = useCallback(async (text) => {
    if (!text) return;
    // Guard Clause (OCP/SRP): Prevention of database desynchronization
    if (activeAssignment?.id && currentAssignmentId !== activeAssignment.id) {
      setStatusMsg("Synchronization Error: The displayed assignment does not match the internal state. Please reload the page.");
      return;
    }
    setLoading(true);
    setStatusMsg("Saving manual feedback as pending...");
    try {
      const result = await api.post('/feedback/manual', {
        courseId,
        assignmentId: currentAssignmentId,
        studentId: currentStudent.id,
        content: text,
        grade: grade
      });
      if (!result.exito) throw new Error("Error sending feedback manual");
      setStatusMsg("Manual feedback successfully saved as pending!");
      
      if (result.data) {
        setFeedback(result.data.contenido_generado || text);
        setGeneratedFeedbackId(result.data.id);
      }
      if (setIsManualMode) {
        setIsManualMode(false);
      }
      
      queryClient.invalidateQueries({ queryKey: ['feedbackDetail', courseId, currentStudent.id] });
      queryClient.invalidateQueries({ queryKey: ['pending-summary'] });
      queryClient.invalidateQueries({ queryKey: ['feedback-list'] });
    } catch (e) {
      logger.error('SpeedGrader', "Error sending feedback manual", { error: e });
      setStatusMsg("Error sending feedback manual.");
    } finally {
      setLoading(false);
    }
  }, [courseId, currentAssignmentId, currentStudent, grade, setFeedback, setLoading, setStatusMsg, queryClient, setGeneratedFeedbackId, setIsManualMode]);

  const handleExit = useCallback(
    async (e) => {
      await logExit('SPEEDGRADER_EXIT', () => onExit?.())(e);
    },
    [onExit, logExit]
  );

  return { handleGenerateMassive, handleApprove, handleManualSubmit, handleExit };
}
