import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import { AuthProvider, useAuth } from '../views/context/AuthContext';
import ProtectedRoute from '../views/components/ProtectedRoute';
import LoadingScreen from './LoadingScreen';
import AccessDenied from './AccessDenied';
import { useLogger } from '../hooks/useLogger';
import logger from '../utils/logger';
import GlobalSystemErrorNotifier from '../components/atoms/GlobalSystemErrorNotifier';

// ── Lazy imports — Layouts and main views ──────────────────────────────
const AdminLayout = lazy(() => import('../views/layouts/AdminLayout'));
const TeacherLayout = lazy(() => import('../views/layouts/TeacherLayout'));
const AdminPanel = lazy(() => import('../views/admin/AdminPanel'));
const StudentFeedbackView = lazy(() => import('../views/feedback/StudentFeedbackView'));

/**
 * AppRouter — Resolves the interface based on the authenticated role.
 *
 * The /api/config/me call is made by AuthProvider. AccessDenied is shown only when there is no valid session/role.
 */
function AppRouter() {
  const { role, rawRoles, isLoading, apiError } = useAuth();
  const { logClick } = useLogger();
  const navigate = useNavigate();

  const isTrueAdmin = role === 'admin' || (rawRoles && rawRoles.some(r => r.includes('Administrator')));

  if (isLoading) return <LoadingScreen message="Verifying session with the local server..." />;

  logger.info('AppRouter', `SESSION STATE [is_loading: ${isLoading}, role: ${role}]`);

  if (!role) {
    logger.error('AppRouter', 'ACCESS DENIED: No valid role found. Showing AccessDenied.', { apiError });
    return <AccessDenied apiError={apiError} />;
  }

  logger.info('AppRouter', `VALID SESSION. Rendering interface for definitive role: [${role}]`);

  return (
    <>
      <Suspense fallback={<LoadingScreen message="Loading module for your role..." />}>
        <Routes>
          {/* ── ADMIN ROUTES ──────────────────────────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin/*" element={<AdminPanel onExit={() => navigate('/teacher/courses')} />} />
            </Route>
          </Route>

          {/* ── SHARED ROUTES (TEACHER & ADMIN) ───────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'teacher']} />}>
            <Route path="/teacher/*" element={<TeacherLayout isAdminView={role === 'admin'} />} />
          </Route>

          {/* ── STUDENT ROUTES ────────────────────────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['student']} />}>
            <Route path="/student/*" element={<StudentFeedbackView onExit={() => navigate('/')} />} />
          </Route>

          {/* ── CATCH ALL ────────────────────────────────────────────────────── */}
          <Route path="/unauthorized" element={<AccessDenied apiError="Access denied: you do not have permission to view this page." />} />
          <Route path="*" element={<Navigate to={isTrueAdmin ? '/admin' : role === 'teacher' ? '/teacher/courses' : '/student'} replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

/**
 * App — Root composition: global providers + router.
 */
export default function App() {
  return (
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <GlobalSystemErrorNotifier />
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}
