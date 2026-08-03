import { useState } from "react";
import { api } from '@/api';
import logger from "../utils/logger";

export function useFeedbackDetail(feedback, onBack) {
  const [text, setText] = useState(feedback?.feedback || "");
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState(null);

  const confirmApprove = () => setShowConfirm(true);

  const handleApprove = async () => {
    setShowConfirm(false);
    try {
      const result = await api.post('/feedback/approve', {
        feedbackId: feedback.id,
        courseId: feedback.courseId,
        assignmentId: feedback.assignmentId,
        studentId: feedback.studentId,
        content: text
      });
      if (result.exito) {
        logger.info('FeedbackDetail', "Feedback aprobado y enviado a Canvas.", { feedbackId: feedback.id });
        setToast({ message: "Feedback aprobado y enviado a Canvas.", type: "success" });
        setTimeout(() => onBack(), 2000);
      } else {
        logger.error('FeedbackDetail', `Error aprobando feedback: ${result.mensaje}`, { feedbackId: feedback.id });
        setToast({ message: "Error: " + result.mensaje, type: "error" });
      }
    } catch (e) {
      logger.error('FeedbackDetail', "Error al intentar aprobar el feedback", { error: e });
      setToast({ message: "Error al intentar aprobar el feedback.", type: "error" });
    }
  };

  const handleSave = async () => {
    try {
      const result = await api.put(`/feedback/${feedback.id}`, { nuevoContenido: text });
      if (result.exito) {
        logger.info('FeedbackDetail', "Edición guardada exitosamente.", { feedbackId: feedback.id });
        setToast({ message: "Edición guardada exitosamente.", type: "success" });
      }
    } catch (e) {
      logger.error('FeedbackDetail', "Error al guardar edición", { error: e });
      setToast({ message: "Error al guardar edición.", type: "error" });
    }
  };

  return {
    text,
    setText,
    showConfirm,
    setShowConfirm,
    toast,
    setToast,
    confirmApprove,
    handleApprove,
    handleSave,
  };
}
