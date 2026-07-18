import React from 'react';
import logger from '../utils/logger';

/**
 * ErrorBoundary — Captura errores de render de React y muestra un fallback
 * con la traza, evitando que la app quede en blanco.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    logger.error('ErrorBoundary', 'React Error Boundary Caught', { message: error?.message, stack: error?.stack, componentStack: errorInfo?.componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', fontFamily: 'sans-serif', color: 'red' }}>
          <h2>Algo salió mal en el Frontend (React Crash)</h2>
          <pre
            style={{
              background: '#f8d7da',
              padding: '10px',
              border: '1px solid #f5c6cb',
              color: '#721c24',
              overflow: 'auto',
            }}
          >
            {this.state.error && this.state.error.toString()}
          </pre>
          {import.meta.env.DEV && (
            <pre
              style={{
                background: '#f8f9fa',
                padding: '10px',
                marginTop: '10px',
                border: '1px solid #ddd',
                fontSize: '12px',
                overflow: 'auto',
              }}
            >
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: '20px', padding: '10px 20px' }}
          >
            Recargar página
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
