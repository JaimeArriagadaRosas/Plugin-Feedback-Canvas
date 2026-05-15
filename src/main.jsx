import React from 'react'
import ReactDOM from 'react-dom/client'
import ConfigurationWizard from './vista/cursos/ConfigurationWizard'
import MockAppWrapper from './mockups/MockAppWrapper'

// El interruptor principal: Si no hay API (definido en .env), usamos los archivos secundarios de Mockup
const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === "true";

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {USE_MOCK_DATA ? (
      /* Llamada a los archivos secundarios de Mockup */
      <MockAppWrapper />
    ) : (
      /* Llamada a la arquitectura de integración real */
      <ConfigurationWizard />
    )}
  </React.StrictMode>,
)
