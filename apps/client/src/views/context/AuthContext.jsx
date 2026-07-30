import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authReducer, initialState } from './authReducer';
import { ApiError } from '../../utils/ApiError';
import { api } from "shared/api";
import { logout as logoutToken } from "shared/lib/authToken";
import { authKeys } from "shared/lib/queryKeys";
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
  const [state, dispatch] = useReducer(authReducer, initialState);
  const { role, rawRoles, user, userName, courseId, courseName, studentId, selectedCourse, isLoading, apiError } = state;

  const { data, error, refetch } = useQuery({
    queryKey: authKeys.me(),
    queryFn: async () => {
      logger.debug('Auth', 'Consultando /api/config/me vía React Query...');
      try {
        const data = await api.get('/config/me');
        if (!data.exito || !data.role) {
          throw new ApiError(data.error?.mensaje || 'No autorizado', 401);
        }
        return data;
      } catch (err) {
        if (err instanceof ApiError) {
          throw err;
        }
        // If it's a generic error with a status, convert it.
        throw new ApiError(err.message || 'Error', err.status || 500);
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: (failureCount, err) => {
      const status = err?.status;
      // En entorno de iframes LTI (Safari/Chrome ITP), permitimos 1 reintento ante 401 para revalidar cookies/storage
      if (status === 400 || status === 403) return false;
      if (status === 401) return failureCount < 1;
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

      dispatch({ type: 'LOGIN_SUCCESS', payload: data });
    } else if (error) {
      logger.warn('Auth', "No se pudo verificar la sesión:", { message: error.message });
      dispatch({ type: 'LOGIN_ERROR', payload: error.message });
    }
  }, [data, error]);

  const logout = useCallback(async () => {
    try {
      await logoutToken();
      logger.info('Auth', 'LOGOUT: sesión cerrada y token eliminado del frontend.');
    } catch (e) {
      logger.warn('Auth', 'Logout backend falló, limpiando localmente:', { error: e?.message });
    } finally {
      sessionStorage.clear();
      localStorage.removeItem('lti-token');
      queryClient.clear();
      dispatch({ type: 'LOGOUT' });
      window.location.href = '/';
    }
  }, [logoutToken, queryClient]);

  const value = {
    role,
    rawRoles,
    user,
    userName,
    courseId,
    courseName,
    studentId,
    selectedCourse,
    setSelectedCourse: (course) => dispatch({ type: 'SET_SELECTED_COURSE', payload: course }),
    isLoading,
    apiError,
    refetchRole: refetch,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
