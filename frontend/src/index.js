// frontend/src/index.js - React entry point with Canvas LTI context
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LTIProvider } from './components/LTIContext';
import './styles/canvas-theme.css';

// Parse URL params from LTI launch
function getQueryParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    token: params.get('token'),
    courseId: params.get('course_id'),
    assignmentId: params.get('assignment_id'),
    contextTitle: params.get('context_title'),
    resourceTitle: params.get('resource_title')
  };
}

const root = ReactDOM.createRoot(document.getElementById('root'));
const params = getQueryParams();

// Extract user from token (in production, verify with backend)
function decodeToken(token) {
  try {
    // Base64 decode (simplified - in prod use proper JWT verification)
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return decoded;
  } catch {
    return null;
  }
}

const userToken = params.token ? decodeToken(params.token) : null;

root.render(
  <React.StrictMode>
    <LTIProvider 
      token={params.token}
      user={userToken}
      courseId={params.courseId}
      assignmentId={params.assignmentId}
      contextTitle={params.contextTitle}
      resourceTitle={params.resourceTitle}
    >
      <App />
    </LTIProvider>
  </React.StrictMode>
);
