import React from 'react';

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
};

export default function WizardProgress({ currentStep = 0 }) {
  const steps = [
    { id: 0, label: "SELECCIÓN DE CURSO" },
    { id: 1, label: "LISTADO DE TAREAS" },
    { id: 2, label: "GESTIÓN PLANTILLAS" },
    { id: 3, label: "CONFIGURAR FEEDBACK" },
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
