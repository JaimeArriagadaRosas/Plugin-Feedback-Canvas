/**
 * TeacherLayout — Layout and routes for the Teacher role.
 *
 * Accessible for:
 *   - Role 'teacher' (directly from AppRoot — WITHOUT admin bar)
 *   - Role 'admin' at /teacher/* (from AdminLayout — admin sees the admin bar above)
 *
 * IMPORTANT: This component has NO administration bar.
 * The separation is physical and visual:
 *   - A teacher logging in with role teacher → NEVER sees anything from admin.
 *   - An admin logging in with role admin and navigating to /teacher/* → sees the admin
 *     bar above (managed by AdminLayout), but the teacher view itself is identical
 *     to that of a real teacher.
 *
 * FIX: Internal routes use the full /teacher/ prefix because
 *      the internal <Routes> sees the full URL.
 */

import { Routes, Route, Navigate, useNavigate, useParams, useLocation } from 'react-router-dom';
import CourseSelector from '../courses/CourseSelector';
import AssignmentList from '../courses/AssignmentList';
import TemplateManagement from '../templates/TemplateManagement';
import SpeedGraderPanel from '../speedgrader/SpeedGraderPanel';
import FeedbackReviewPanel from '../feedback/FeedbackReviewPanel';
import FeedbackDetailView from '../feedback/FeedbackDetailView';
import VariablesConfigView from '../courses/variables/VariablesConfigView';
import UserMenu from '../components/UserMenu';
import logger from '../../utils/logger';
import { useAuth } from '../context/AuthContext';
import { useCourseData } from '../courses/hooks/useCourseData';
import RequirePermission from '../../components/atoms/RequirePermission';

export default function TeacherLayout({ isAdminView = false }) {
  const navigate   = useNavigate();
  const location   = useLocation();
  return (
    <RequirePermission 
      permission="view_feedback" 
      fallback={
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'Lato, sans-serif', color: '#2d3b45' }}>
          <h2>This feature has been disabled by the administrator.</h2>
        </div>
      }
    >
      <div className="teacher-layout" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', position: 'relative' }}>
        <UserMenu mode="anchored" />
        <a href="#main-content" className="skip-link">Skip to main content</a>

        {/* ────────────────────────────────────────────────────────────────────
          NO TOP BAR HERE.
          The separation of views is non-negotiable:
            • If role=teacher  → only this layout, no admin bar whatsoever.
            • If role=admin and navigates to /teacher/* → AdminLayout manages its
              own bar above; this component only renders the content.
          ──────────────────────────────────────────────────────────────────── */}

      <main id="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
        <Routes>
        {/* Root → course selector */}
        <Route path="/" element={<Navigate to="/teacher/courses" replace />} />

        {/* ── Step 1: Course Selection ─────────────────────────────────── */}
        <Route
          path="courses"
          element={
            <CourseSelector
              onCourseSelected={(course) =>
                navigate(`/teacher/assignments/${course.id}`)
              }
              onApiError={(err) => logger.error('TeacherLayout', 'API Error in courses', { error: err })}
            />
          }
        />

        {/* ── Step 2: Assignment List ────────────────────────────────────── */}
        <Route
          path="assignments/:courseId"
          element={<AssignmentListRoute navigate={navigate} location={location} />}
        />

        {/* ── Step 3: Template Management ─────────────────────────────── */}
        <Route
          path="templates/:courseId/:assignmentId"
          element={<TemplateRoute navigate={navigate} />}
        />

        {/* ── SpeedGrader ───────────────────────────────────────────────── */}
        <Route
          path="speedgrader/:courseId"
          element={<SpeedGraderPanel onExit={() => navigate('/teacher/courses')} />}
        />

        {/* ── Feedback Review ──────────────────────────────────────────── */}
        <Route
          path="review"
          element={
            <FeedbackReviewPanel
              onEditFeedback={(fb) => navigate(`/teacher/review/detail/${fb.id}`)}
            />
          }
        />

        {/* ── Feedback Detail ───────────────────────────────────────────── */}
        <Route
          path="review/detail/:feedbackId"
          element={<FeedbackDetailView onBack={() => navigate('/teacher/review')} />}
        />

        {/* ── Variable Configuration ──────────────────────────────────── */}
        <Route
          path="variables"
          element={<VariablesConfigView />}
        />

        {/* Catch-all → courses */}
        <Route path="*" element={<Navigate to="/teacher/courses" replace />} />
        </Routes>
        </main>
      </div>
    </RequirePermission>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal route components — use useParams() to read URL parameters
// ─────────────────────────────────────────────────────────────────────────────

function AssignmentListRoute({ navigate }) {
  const { courseId } = useParams();
  const { selectedCourse } = useAuth();
  const { courses } = useCourseData();
  
  const foundCourse = courses?.find(c => String(c.id) === String(courseId));
  const course = selectedCourse || foundCourse || { id: courseId, name: 'Selected Course' };

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
      onNext={() => navigate(`/teacher/speedgrader/${courseId}`)}
    />
  );
}
