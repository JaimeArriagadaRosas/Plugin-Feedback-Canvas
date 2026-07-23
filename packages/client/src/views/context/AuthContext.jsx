import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  const queryClient = useQueryClient();
  const [role, setRole] = useState(null);
  const [rawRoles, setRawRoles] = useState([]);
  const [user, setUser] = useState(null);
  const [courseId, setCourseId] = useState(null);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState(null);

  const { data, error, refetch } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      logger.debug('Auth', 'Consultando /api/config/me vía React Query...');
      const data = await api.get('/config/me');
      if (!data.exito || !data.role) {
        throw new Error(data.error?.mensaje || 'No autorizado');
      }
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: (failureCount, err) => {
      const status = err?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 2;
    }
  });

  useEffect(() => {
    if (data) {
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
      setRawRoles(data.roles || []);
      setUser(data.user);
      setCourseId(data.courseId);
      setApiError(null);
      setIsLoading(false);
    } else if (error) {
      logger.warn('Auth', "No se pudo verificar la sesión:", { message: error.message });
      setApiError(error.message);
      setRole(null);
      setUser(null);
      setCourseId(null);
      setIsLoading(false);
    }
  }, [data, error]);

  const logout = useCallback(async () => {
    try {
      await logoutToken();
      logger.info('Auth', 'LOGOUT: sesión cerrada y token eliminado del frontend.');
    } catch (e) {
      logger.warn('Auth', 'Logout backend falló, limpiando localmente:', { error: e?.message });
    } finally {
      queryClient.invalidateQueries(['auth']);
      setRole(null);
      setRawRoles([]);
      setUser(null);
      setCourseId(null);
      setApiError(null);
      setIsLoading(false);
      window.location.href = '/';
    }
  }, [logoutToken, queryClient]);

  const value = {
    role,
    rawRoles,
    user,
    courseId,
    selectedCourse,
    setSelectedCourse,
    isLoading,
    apiError,
    refetchRole: refetch,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
