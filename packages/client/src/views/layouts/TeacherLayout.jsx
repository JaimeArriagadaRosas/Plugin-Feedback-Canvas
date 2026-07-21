/**
 * TeacherLayout — Layout y rutas para el rol Docente.
 *
 * Accesible para:
 *   - Rol 'teacher' (directamente desde AppRoot — SIN barra de admin)
 *   - Rol 'admin' en /teacher/* (desde AdminLayout — admin ve la barra de admin arriba)
 *
 * IMPORTANTE: Este componente NO tiene ninguna barra de administración.
 * La separación es física y visual:
 *   - Un docente que entra con rol teacher → JAMÁS ve nada de admin.
 *   - Un admin que entra con rol admin y navega a /teacher/* → ve la barra de
 *     admin encima (gestionada por AdminLayout), pero la vista del docente
 *     en sí es idéntica a la del teacher real.
 *
 * FIX: Las rutas internas usan el prefijo /teacher/ completo porque
 *      el <Routes> interno de este componente ve la URL completa.
 */

import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import CourseSelector from '../cursos/CourseSelector';
import AssignmentList from '../cursos/AssignmentList';
import TemplateManagement from '../plantillas/TemplateManagement';
import SpeedGraderPanel from '../speedgrader/SpeedGraderPanel';
import FeedbackReviewPanel from '../feedback/FeedbackReviewPanel';
import FeedbackDetailView from '../feedback/FeedbackDetailView';
import UserMenu from '../components/UserMenu';
import logger from '../../utils/logger';

export default function TeacherLayout({ isAdminView = false }) {
  const navigate   = useNavigate();
  const location   = useLocation();

  return (
    <div className="teacher-layout" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <UserMenu mode="anchored" />
      <a href="#main-content" className="skip-link">Saltar al contenido principal</a>

      {/* ────────────────────────────────────────────────────────────────────
          NO HAY BARRA SUPERIOR AQUÍ.
          La separación de vistas es innegociable:
            • Si role=teacher  → solo este layout, sin ninguna barra de admin.
            • Si role=admin y navega a /teacher/* → AdminLayout gestiona su
              propia barra arriba; este componente solo renderiza el contenido.
          ──────────────────────────────────────────────────────────────────── */}

      <main id="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <Routes>
        {/* Raíz → selector de cursos */}
        <Route path="/" element={<Navigate to="/teacher/courses" replace />} />

        {/* ── Paso 1: Selección de Curso ─────────────────────────────────── */}
        <Route
          path="courses"
          element={
            <CourseSelector
              onCourseSelected={(course) =>
                navigate(`/teacher/assignments/${course.id}`, { state: { course } })
              }
              onApiError={(err) => logger.error('TeacherLayout', 'API Error en cursos', { error: err })}
            />
          }
        />

        {/* ── Paso 2: Lista de Tareas ────────────────────────────────────── */}
        <Route
          path="assignments/:courseId"
          element={<AssignmentListRoute navigate={navigate} location={location} />}
        />

        {/* ── Paso 3: Gestión de Plantillas ─────────────────────────────── */}
        <Route
          path="templates/:courseId/:assignmentId"
          element={<TemplateRoute navigate={navigate} />}
        />

        {/* ── SpeedGrader ───────────────────────────────────────────────── */}
        <Route
          path="speedgrader"
          element={<SpeedGraderPanel onExit={() => navigate('/teacher/courses')} />}
        />

        {/* ── Revisión de Feedback ──────────────────────────────────────── */}
        <Route
          path="review"
          element={
            <FeedbackReviewPanel
              onEditFeedback={(fb) => navigate(`/teacher/review/detail/${fb.id}`)}
            />
          }
        />

        {/* ── Detalle de Feedback ───────────────────────────────────────── */}
        <Route
          path="review/detail/:feedbackId"
          element={<FeedbackDetailView onBack={() => navigate('/teacher/review')} />}
        />

        {/* Catch-all → cursos */}
        <Route path="*" element={<Navigate to="/teacher/courses" replace />} />
      </Routes>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componentes de ruta internos — usan useParams() para leer parámetros de URL
// ─────────────────────────────────────────────────────────────────────────────

function AssignmentListRoute({ navigate, location }) {
  const { courseId } = useParams();
  const course = location.state?.course || { id: courseId, name: 'Curso Seleccionado' };

  return (
    <AssignmentList
      course={course}
      onBack={() => navigate('/teacher/courses')}
      onNext={(assignmentId) => navigate(`/teacher/templates/${courseId}/${assignmentId ?? 1}`)}
    />
  );
}

function TemplateRoute({ navigate }) {
  const { courseId, assignmentId } = useParams();

  return (
    <TemplateManagement
      courseId={courseId}
      assignmentId={assignmentId}
      onBack={() => navigate(`/teacher/assignments/${courseId}`)}
      onNext={() => navigate(`/teacher/speedgrader`)}
    />
  );
}

