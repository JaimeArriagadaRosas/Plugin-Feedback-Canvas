import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import { assignmentKeys } from 'shared/lib/queryKeys';

const styles = {
  wizard: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
    flexShrink: 0,
    flexWrap: "wrap",
  },
  wizardStep: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 12,
    color: "#888",
    fontWeight: 400,
    whiteSpace: "nowrap",
  },
  wizardStepActive: {
    color: "#2d3b45",
    fontWeight: 700,
  },
  wizardCircle: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    border: "2px solid #c7cdd1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    color: "#888",
    background: "#fff",
    flexShrink: 0,
  },
  wizardCircleActive: {
    borderColor: "#0770a3",
    color: "#0770a3",
  },
  wizardLine: {
    flex: 1,
    height: 2,
    background: "#c7cdd1",
    minWidth: 20,
    maxWidth: 60,
    margin: "0 6px",
  },
  wizardLineActive: {
    background: "#0770a3",
  },
  badgeWarning: {
    background: "#f39c12",
    color: "#fff",
    padding: "2px 6px",
    borderRadius: "10px",
    fontSize: "10px",
    fontWeight: "bold",
    marginLeft: "4px"
  }
};

export default function WizardProgress({ currentStep = 0 }) {
  const auth = useAuth() || {};
  const selectedCourse = auth.selectedCourse || null;
  const { data: assignments = [] } = useQuery({
    queryKey: assignmentKeys.byCourse(selectedCourse?.id),
    enabled: !!selectedCourse?.id,
  });

  const orphanedCount = assignments.filter(a => Boolean(a.active) === true && (!a.plantilla_id && !a.template)).length;

  const steps = [
    { id: 0, label: "SELECCIÓN DE CURSO", warning: false },
    { id: 1, label: "LISTADO DE TAREAS", warning: orphanedCount > 0 },
    { id: 2, label: "GESTIÓN PLANTILLAS", warning: orphanedCount > 0 },
    { id: 3, label: "CONFIGURAR FEEDBACK", warning: false },
  ];

  return (
    <div style={styles.wizard}>
      {steps.map((step, index) => (
        <React.Fragment key={step.id}>
          <div style={{ 
            ...styles.wizardStep, 
            ...(currentStep === step.id ? styles.wizardStepActive : {}) 
          }}>
            <div style={{ 
              ...styles.wizardCircle, 
              ...(currentStep >= step.id ? styles.wizardCircleActive : {}) 
            }}>
              {step.id}
            </div>
            {step.label} {currentStep === step.id ? "[activo]" : (currentStep > step.id ? "[completado]" : "")}
            {step.warning && (
              <span style={styles.badgeWarning} title="Existen tareas activas sin plantilla asignada">
                ⚠️ Sin Plantilla
              </span>
            )}
          </div>
          {index < steps.length - 1 && (
            <div style={{ 
              ...styles.wizardLine, 
              ...(currentStep > step.id ? styles.wizardLineActive : {}) 
            }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
