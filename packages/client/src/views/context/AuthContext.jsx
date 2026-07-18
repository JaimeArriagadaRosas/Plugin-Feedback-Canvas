import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from "shared/api";
import { logout as logoutToken } from "shared/lib/authToken";
import logger from "../../utils/logger";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(null);
  const [courseId, setCourseId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  const fetchRole = useCallback(async () => {
    try {
      logger.debug('Auth', 'Iniciando verificación de sesión...');
      const data = await api.get('/config/me');
      if (data.exito && data.role) {
        const sourceLabel =
          data.source === 'lti' ? 'Canvas LMS (JWT LTI 1.3 real)' :
          data.source === 'local' ? 'Sesión local (modo dev)' :
          data.source === 'dev-token' ? 'dev-token (bypass local)' :
          (data.source || 'desconocido');
        const correcto = data.source === 'lti';

        logger.info('Auth', `LOGIN correcto | Usuario: ${data.user} | Permisos: ${data.role} | Fuente: ${sourceLabel}`, { correcto });

        if (data.role === 'admin') {
          logger.info('Auth', 'Permisos de Administrador habilitados. Acceso total al sistema.');
        } else if (data.role === 'teacher') {
          logger.info('Auth', 'Permisos de Profesor habilitados. Gestión docente.');
        } else if (data.role === 'student') {
          logger.info('Auth', 'Restricciones de Estudiante aplicadas. Solo vista de alumno.');
        } else {
          logger.warn('Auth', `Rol desconocido: ${data.role}`);
        }

        if (!correcto) {
          logger.warn('Auth', 'El login NO provino de un JWT real de Canvas. Fuente detectada:', sourceLabel);
        } else {
          logger.info('Auth', 'Todo correcto: sesión autenticada contra Canvas LMS vía LTI 1.3.');
        }

        setRole(data.role);
        setUser(data.user);
        setCourseId(data.courseId);
        setApiError(null);
      } else {
        logger.warn('Auth', "No se pudo verificar la sesión:", data);
        setApiError(JSON.stringify(data));
        setRole(null);
      }
    } catch (e) {
      logger.error('Auth', `Error de red durante la verificación: ${e.message}`, { error: e });
      setApiError(`Error de red: ${e.message}`);
      setRole(null);
    } finally {
      setIsLoading(false);
      logger.debug('Auth', 'Proceso de verificación finalizado.');
    }
  }, []);

  useEffect(() => {
    fetchRole();
  }, [fetchRole]);

  const logout = useCallback(async () => {
    try {
      await logoutToken();
      logger.info('Auth', 'LOGOUT: sesión cerrada y token eliminado del frontend.');
    } catch (e) {
      logger.warn('Auth', `Logout backend falló, limpiando localmente: ${e?.message}`);
    } finally {
      setRole(null);
      setUser(null);
      setCourseId(null);
      setApiError(null);
      window.location.href = '/';
    }
  }, [logoutToken]);

  const value = {
    role,
    user,
    courseId,
    isLoading,
    apiError,
    fetchRole,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
