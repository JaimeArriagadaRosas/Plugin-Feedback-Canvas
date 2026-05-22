import React, { useState } from "react";
import MockCanvasLayout from "./MockCanvasLayout";
import MockConfigurationWizard from "./MockConfigurationWizard";

export default function MockAppWrapper() {
  const [isStudentView, setIsStudentView] = useState(false);

  return (
    <MockCanvasLayout isStudentView={isStudentView}>
      <MockConfigurationWizard onStudentViewChange={setIsStudentView} />
    </MockCanvasLayout>
  );
}
