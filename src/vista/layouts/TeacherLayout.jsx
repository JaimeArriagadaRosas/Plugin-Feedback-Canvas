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

export default function TeacherLayout({ isAdminView = false }) {
  const navigate   = useNavigate();
  const location   = useLocation();

  return (
    <div className="teacher-layout" style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* ────────────────────────────────────────────────────────────────────
          NO HAY BARRA SUPERIOR AQUÍ.
          La separación de vistas es innegociable:
            • Si role=teacher  → solo este layout, sin ninguna barra de admin.
            • Si role=admin y navega a /teacher/* → AdminLayout gestiona su
              propia barra arriba; este componente solo renderiza el contenido.
          ──────────────────────────────────────────────────────────────────── */}

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
              onApiError={(err) => console.error('[TeacherLayout] API Error en cursos:', err)}
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

        {/* ── Paso 4: Configuración lista ───────────────────────────────── */}
        <Route
          path="config-ready/:courseId/:assignmentId"
          element={<ConfigReadyRoute navigate={navigate} />}
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
      onNext={() => navigate(`/teacher/templates/${courseId}/1`)}
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
      onNext={() => navigate(`/teacher/config-ready/${courseId}/${assignmentId}`)}
    />
  );
}

function ConfigReadyRoute({ navigate }) {
  const { courseId, assignmentId } = useParams();

  return (
    <div style={{
      padding: '40px',
      textAlign: 'center',
      fontFamily: "'Lato', sans-serif",
      background: '#f5f5f5',
      minHeight: '100vh'
    }}>
      <div style={{
        maxWidth: '600px',
        margin: '0 auto',
        background: '#fff',
        border: '1px solid #c7cdd1',
        borderRadius: '8px',
        padding: '40px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
        <h2 style={{ fontSize: '22px', fontWeight: '700', color: '#2d3b45', marginBottom: '8px' }}>
          Configuración Lista
        </h2>
        <p style={{ color: '#666', lineHeight: '1.6', marginBottom: '8px' }}>
          La plantilla de feedback está configurada para esta tarea.
        </p>
        <p style={{ color: '#888', fontSize: '13px', marginBottom: '30px' }}>
          Curso: <strong>{courseId}</strong> · Tarea: <strong>{assignmentId}</strong>
        </p>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', flexWrap: 'wrap' }}>
          <button
            style={{ padding: '10px 22px', background: '#fff', border: '1px solid #c7cdd1', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}
            onClick={() => navigate(`/teacher/templates/${courseId}/${assignmentId}`)}
          >
            ← Volver a Plantillas
          </button>
          <button
            style={{ padding: '10px 22px', background: '#0770a3', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
            onClick={() => navigate('/teacher/speedgrader')}
          >
            🚀 Lanzar SpeedGrader
          </button>
          <button
            style={{ padding: '10px 22px', background: '#27ae60', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
            onClick={() => navigate('/teacher/review')}
          >
            📋 Revisar Feedback
          </button>
        </div>
      </div>
    </div>
  );
}
