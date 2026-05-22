import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import ConfigurationWizard from './vista/cursos/ConfigurationWizard'
import MockAppWrapper from './mockups/MockAppWrapper'

const INITIAL_USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === "true";

function AppRoot() {
  const [useMockData, setUseMockData] = useState(INITIAL_USE_MOCK_DATA);

  return (
    <React.StrictMode>
      {useMockData ? (
        <MockAppWrapper />
      ) : (
        <ConfigurationWizard onApiError={() => setUseMockData(true)} />
      )}
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AppRoot />);
