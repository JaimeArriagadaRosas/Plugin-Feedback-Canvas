import React, { useState } from "react";
import VisualizacionCanvasLayout from "./VisualizacionCanvasLayout";
import LocalConfigurationWizard from "./LocalConfigurationWizard";

export default function LocalAppWrapper() {
  const [isStudentView, setIsStudentView] = useState(false);

  return (
    <VisualizacionCanvasLayout isStudentView={isStudentView}>
      <LocalConfigurationWizard onStudentViewChange={setIsStudentView} />
    </VisualizacionCanvasLayout>
  );
}
