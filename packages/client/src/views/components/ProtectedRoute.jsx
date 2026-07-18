import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ allowedRoles }) {
  const { role, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ padding: 40, fontFamily: "'Lato', sans-serif", color: "#2d3b45", display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{ width: 20, height: 20, border: "3px solid #c7cdd1", borderTopColor: "#0770a3", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        Verificando permisos...
      </div>
    );
  }

  if (!role) {
    // Si no hay rol, probablemente la sesión expiró o es inválida
    return <Navigate to="/unauthorized" replace />;
  }

  if (!allowedRoles.includes(role)) {
    // El usuario está logueado pero no tiene el rol necesario
    // Redirigimos a una ruta segura dependiendo de su rol real
    if (role === 'student') return <Navigate to="/student/courses" replace />;
    if (role === 'teacher') return <Navigate to="/teacher/courses" replace />;
    if (role === 'admin') return <Navigate to="/admin" replace />;
    return <Navigate to="/unauthorized" replace />;
  }

  // Tiene el rol permitido
  return <Outlet />;
}
