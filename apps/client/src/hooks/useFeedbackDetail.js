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
        logger.info('FeedbackDetail', "Feedback approved and sent to Canvas.", { feedbackId: feedback.id });
        setToast({ message: "Feedback approved and sent to Canvas.", type: "success" });
        setTimeout(() => onBack(), 2000);
      } else {
        logger.error('FeedbackDetail', `Error approving feedback: ${result.mensaje}`, { feedbackId: feedback.id });
        setToast({ message: "Error: " + result.mensaje, type: "error" });
      }
    } catch (e) {
      logger.error('FeedbackDetail', "Error trying to approve feedback", { error: e });
      setToast({ message: "Error trying to approve feedback.", type: "error" });
    }
  };

  const handleSave = async () => {
    try {
      const result = await api.put(`/feedback/${feedback.id}`, { nuevoContenido: text });
      if (result.exito) {
        logger.info('FeedbackDetail', "Edit saved successfully.", { feedbackId: feedback.id });
        setToast({ message: "Edit saved successfully.", type: "success" });
      }
    } catch (e) {
      logger.error('FeedbackDetail', "Error saving edit", { error: e });
      setToast({ message: "Error saving edit.", type: "error" });
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
