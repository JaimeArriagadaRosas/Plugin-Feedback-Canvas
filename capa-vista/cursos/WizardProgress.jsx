import React from 'react';

const styles = {
  wizard: {
    display: "flex",
    alignItems: "center",
    gap: 0,
    marginBottom: 8,
    marginTop: 20,
  },
  wizardStep: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 13,
    color: "#888",
    fontWeight: 400,
  },
  wizardStepActive: {
    color: "#2d3b45",
    fontWeight: 700,
  },
  wizardCircle: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    border: "2px solid #c7cdd1",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
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
    minWidth: 40,
    maxWidth: 150,
    margin: "0 10px",
  },
  wizardLineActive: {
    background: "#0770a3",
  },
};

export default function WizardProgress({ currentStep = 1 }) {
  const steps = [
    { id: 0, label: "GESTIÓN PLANTILLAS" },
    { id: 1, label: "SELECT COURSE" },
    { id: 2, label: "LIST ASSIGNMENTS" },
    { id: 3, label: "CONFIGURE FEEDBACK" },
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
            {step.label} {currentStep === step.id ? "[activo]" : (currentStep > step.id ? "[completed]" : "")}
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
