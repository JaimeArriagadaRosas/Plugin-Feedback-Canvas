import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ allowedRoles }) {
  const { role, rawRoles, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ padding: 40, fontFamily: "'Lato', sans-serif", color: "#2d3b45", display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: 20, height: 20, border: "3px solid #c7cdd1", borderTopColor: "#0770a3", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        Verifying permissions...
      </div>
    );
  }

  if (!role) {
    // If there is no role, the session probably expired or is invalid
    return <Navigate to="/unauthorized" replace />;
  }

  const isTrueAdmin = role === 'admin' || (rawRoles && rawRoles.some(r => r.includes('Administrator')));

  if (allowedRoles.includes('admin') && isTrueAdmin) {
    // Allow access to true admins even if their context 'role' is different
    return <Outlet />;
  }

  if (!allowedRoles.includes(role)) {
    // The user is logged in but does not have the necessary role
    // Redirect to a safe route depending on their actual role
    if (role === 'student') return <Navigate to="/student/courses" replace />;
    if (role === 'teacher') return <Navigate to="/teacher/courses" replace />;
    if (role === 'admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/unauthorized" replace />;
  }

  // Has the allowed role
  return <Outlet />;
}
