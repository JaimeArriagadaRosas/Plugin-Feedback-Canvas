import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import ConfigurationWizard from './vista/cursos/ConfigurationWizard'
import LocalAppWrapper from './local/LocalAppWrapper'

const INITIAL_USE_LOCAL_DATA = import.meta.env.VITE_USE_LOCAL_DATA === "true";

function AppRoot() {
  const [useLocalData, setUseLocalData] = useState(INITIAL_USE_LOCAL_DATA);

  return (
    <React.StrictMode>
      {useLocalData ? (
        <LocalAppWrapper />
      ) : (
        <ConfigurationWizard onApiError={() => setUseLocalData(true)} />
      )}
    </React.StrictMode>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<AppRoot />);
