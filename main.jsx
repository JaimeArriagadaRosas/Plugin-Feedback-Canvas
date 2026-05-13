import React from 'react'
import ReactDOM from 'react-dom/client'
import ConfigurationWizard from './capa-vista/cursos/ConfigurationWizard'
import MainLayout from './capa-vista/layout/MainLayout'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <MainLayout>
      <ConfigurationWizard />
    </MainLayout>
  </React.StrictMode>,
)
