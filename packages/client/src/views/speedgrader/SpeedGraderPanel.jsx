import { useCallback, useState } from 'react';
import { api } from 'shared/api';
import Button from '../../components/atoms/Button';
import { useButtonLogger } from '../../hooks/useButtonLogger';
import { useSpeedGraderData } from './hooks/useSpeedGraderData';
import StudentNavigator from './StudentNavigator';
import AssignmentSelector from './AssignmentSelector';
import GradeInput from './GradeInput';
import SubmissionViewer from './SubmissionViewer';
import FeedbackGenerator from './FeedbackGenerator';
import styles from './SpeedGraderPanel.module.css';
import logger from '../../utils/logger';

export default function SpeedGraderPanel({ onExit }) {
  const {
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
    submissionText,
    activeAssignment,
    feedback,
    setFeedback,
    generatedFeedbackId,
    setGeneratedFeedbackId,
  } = useSpeedGraderData();

  const logGenerate = useButtonLogger();
  const logApprove = useButtonLogger();
  const logExit = useButtonLogger();

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setStatusMsg("Conectando con el motor de IA...");
    try {
      const result = await api.post('/feedback/generate', {
        courseId: courseId,
        assignmentId: currentAssignmentId,
        studentId: currentStudent.id,
        templateId: 1, // TODO: Seleccionar template real
        grade: grade,
      });
      if (result.exito && result.data) {
        setFeedback(result.data.content);
        setGeneratedFeedbackId(result.data.id);
        setStatusMsg("Feedback generado exitosamente.");
      } else {
        throw new Error(result.mensaje || "La respuesta del servidor no tiene el formato esperado.");
      }
    } catch (error) {
      logger.error('SpeedGrader', "Error al generar feedback", { error });
      setFeedback(`[ERROR] ${error.message}`);
      setStatusMsg("Error en la generación.");
    } finally {
      setLoading(false);
    }
  }, [currentAssignmentId, currentStudent, grade]);

  const handleApprove = useCallback(async (rating) => {
    if (!generatedFeedbackId) return;
    setLoading(true);
    setStatusMsg("Guardando y enviando feedback y nota...");
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
      if (!result.exito) throw new Error("Error al aprobar feedback");
      setStatusMsg("¡Enviado exitosamente a Canvas!");
      setGeneratedFeedbackId(null);
    } catch (e) {
      logger.error('SpeedGrader', "Error al enviar feedback", { error: e });
      setStatusMsg("Error al enviar.");
    } finally {
      setLoading(false);
    }
  }, [generatedFeedbackId, currentAssignmentId, currentStudent, feedback, grade]);

  const handleManualSubmit = useCallback(async (manualFeedbackText) => {
    if (!manualFeedbackText) return;
    setLoading(true);
    setStatusMsg("Enviando feedback manual a Canvas...");
    try {
      const result = await api.post('/feedback/manual', {
        courseId: courseId,
        assignmentId: currentAssignmentId,
        studentId: currentStudent.id,
        contenidoManual: manualFeedbackText,
        grade: grade,
      });
      if (!result.exito) throw new Error("Error al enviar feedback manual");
      setStatusMsg("¡Feedback manual enviado exitosamente a Canvas!");
      setFeedback(''); // Opcional, limpiar tras éxito
    } catch (e) {
      logger.error('SpeedGrader', "Error al enviar feedback manual", { error: e });
      setStatusMsg("Error al enviar feedback manual.");
    } finally {
      setLoading(false);
    }
  }, [courseId, currentAssignmentId, currentStudent, grade]);

  const handleExit = useCallback(
    async (e) => {
      await logExit('SPEEDGRADER_EXIT', () => onExit?.())(e);
    },
    [onExit, logExit]
  );

  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Button variant="ghost" size="sm" onClick={handleExit}>
            <span>📊</span> Libro de Calificaciones
          </Button>
          <div className={styles.divider} />
          <AssignmentSelector
            assignments={assignments}
            currentAssignmentId={currentAssignmentId}
            onChange={setCurrentAssignmentId}
          />
        </div>

        <div className={styles.headerRight}>
          <Button variant="ghost" size="sm" onClick={() => window.open('https://youtube.com/shorts/unida-tutorial', '_blank')}>
            <span>🎬</span> Tutoriales
          </Button>
          <div className={styles.divider} />
          <StudentNavigator
            students={students}
            currentIndex={currentIndex}
            onChange={setCurrentIndex}
            onExit={onExit}
          />
        </div>
      </header>

      <main className={styles.main}>
        <SubmissionViewer
          submissionText={submissionText}
          studentName={currentStudent.name}
          assignmentName={activeAssignment.name}
        />

        <section className={styles.gradingPanel}>
          <div className={styles.gradeTitle}>Calificación</div>
          <GradeInput grade={grade} maxPoints={activeAssignment.points} onChange={setGrade} />
        </section>

        <FeedbackGenerator
          loading={loading}
          feedback={feedback}
          setFeedback={setFeedback}
          generatedFeedbackId={generatedFeedbackId}
          onGenerate={handleGenerate}
          onApprove={handleApprove}
          onManualSubmit={handleManualSubmit}
          grade={grade}
          activeAssignment={activeAssignment}
        />
      </main>

      <footer className={styles.footer}>
        STATUS: {statusMsg} | API: /api/feedback/generate
      </footer>
    </div>
  );
}
