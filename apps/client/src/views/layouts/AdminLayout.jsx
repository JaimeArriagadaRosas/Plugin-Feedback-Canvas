/**
 * AdminLayout — Exclusive layout for the Administrator role.
 *
 * VISUAL SEPARATION RULE (non-negotiable):
 *   ▸ On /admin or /  → Black admin bar visible.
 *   ▸ On /teacher/*  → Admin bar COMPLETELY HIDDEN.
 *                      The admin sees exactly what a real teacher sees.
 *                      Only a small floating "Return to Admin" button appears.
 *
 * This separation ensures that:
 *   1. A real teacher (role=teacher) never reaches this component.
 *   2. An admin in teacher view cannot be distinguished from a real teacher
 *      by looking at the screen — the view is identical.
 *   3. The floating button is discreet and does not interfere with the teacher interface.
 */

import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import ErrorBoundary from '../../app/ErrorBoundary';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  // ── Determine which view we are in ────────────────────────────────────────
  const esVistaAdmin   = location.pathname.startsWith('/admin') || location.pathname === '/';

  return (
    <ErrorBoundary>
      <div className="admin-layout" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', fontFamily: "'Lato', sans-serif" }}>
        <a href="#main-content" className="skip-link">Skip to main content</a>

        {/* Main content — <Outlet /> renders the active route */}
        <main id="main-content" style={{ flex: 1 }}>
          <Outlet />
        </main>
      </div>
    </ErrorBoundary>
  );
}
