import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

import { AuthProvider, useAuth } from '../views/context/AuthContext';
import ProtectedRoute from '../views/components/ProtectedRoute';
import LoadingScreen from './LoadingScreen';
import AccessDenied from './AccessDenied';
import { useLogger } from '../hooks/useLogger';
import logger from '../utils/logger';

// ── Lazy imports — Layouts y vistas principales ──────────────────────────────
const AdminLayout = lazy(() => import('../views/layouts/AdminLayout'));
const TeacherLayout = lazy(() => import('../views/layouts/TeacherLayout'));
const AdminPanel = lazy(() => import('../views/admin/AdminPanel'));
const StudentFeedbackView = lazy(() => import('../views/feedback/StudentFeedbackView'));

/**
 * AppRouter — Resuelve la interfaz según el rol autenticado.
 *
 * La llamada a /api/config/me la realiza AuthProvider. Sólo si no hay una
 * sesión/rol válido se muestra AccessDenied.
 */
function AppRouter() {
  const { role, rawRoles, isLoading, apiError } = useAuth();
  const { logClick } = useLogger();
  const navigate = useNavigate();

  const isTrueAdmin = role === 'admin' || (rawRoles && rawRoles.some(r => r.includes('Administrator')));

  if (isLoading) return <LoadingScreen message="Verificando sesión con el servidor local..." />;

  logger.info('AppRouter', `ESTADO DE SESIÓN [is_loading: ${isLoading}, role: ${role}]`);

  if (!role) {
    logger.error('AppRouter', 'ACCESO DENEGADO: No hay rol válido. Mostrando AccessDenied.', { apiError });
    return <AccessDenied apiError={apiError} />;
  }

  logger.info('AppRouter', `SESIÓN VÁLIDA. Renderizando interfaz para rol definitivo: [${role}]`);

  return (
    <>
      <Suspense fallback={<LoadingScreen message="Cargando módulo para tu rol..." />}>
        <Routes>
          {/* ── RUTAS ADMIN ──────────────────────────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin/*" element={<AdminPanel onExit={() => navigate('/teacher/courses')} />} />
            </Route>
          </Route>

          {/* ── RUTAS SHARED (TEACHER & ADMIN) ───────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['admin', 'teacher']} />}>
            <Route path="/teacher/*" element={<TeacherLayout isAdminView={role === 'admin'} />} />
          </Route>

          {/* ── RUTAS STUDENT ────────────────────────────────────────────────── */}
          <Route element={<ProtectedRoute allowedRoles={['student']} />}>
            <Route path="/student/*" element={<StudentFeedbackView onExit={() => navigate('/')} />} />
          </Route>

          {/* ── CATCH ALL ────────────────────────────────────────────────────── */}
          <Route path="/unauthorized" element={<AccessDenied apiError="Acceso denegado: no tienes permiso para ver esta vista." />} />
          <Route path="*" element={<Navigate to={isTrueAdmin ? '/admin' : role === 'teacher' ? '/teacher/courses' : '/student'} replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

/**
 * App — Composición raíz: providers globales + router.
 */
export default function App() {
  return (
    <React.StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}
