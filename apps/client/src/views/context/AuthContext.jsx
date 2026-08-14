import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authReducer, initialState } from './authReducer';
import { ApiError } from '../../utils/ApiError';
import { api } from '@/api';
import { logout as logoutToken } from '@/lib/authToken';
import { authKeys } from '@/lib/queryKeys';
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
  const { role, rawRoles, permissions, user, userName, courseId, courseName, studentId, selectedCourse, isLoading, apiError } = state;

  const { data, error, refetch } = useQuery({
    queryKey: authKeys.me(),
    queryFn: async () => {
      logger.debug('Auth', 'Querying /api/config/me via React Query...');
      try {
        const data = await api.get('/config/me');
        if (!data.exito || !data.role) {
          throw new ApiError(data.error?.mensaje || 'Unauthorized', 401);
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
      // In LTI iframe environments (Safari/Chrome ITP), we allow 1 retry on 401 to revalidate cookies/storage
      if (status === 400 || status === 403) return false;
      if (status === 401) return failureCount < 1;
      return failureCount < 2;
    }
  });

  useEffect(() => {
    if (data) {
      const sourceLabel =
        data.source === 'lti' ? 'Canvas LMS (real LTI 1.3 JWT)' :
        data.source === 'local' ? 'Local session (dev mode)' :
        data.source === 'dev-token' ? 'dev-token (bypass local)' :
        (data.source || 'unknown');
      const isCorrect = data.source === 'lti';

      logger.info('Auth', `Successful LOGIN | User: ${data.user} | Permissions: ${data.role} | Source: ${sourceLabel}`, { isCorrect });

      if (data.role === 'admin') {
        logger.info('Auth', 'Administrator permissions enabled. Full system access.');
      } else if (data.role === 'teacher') {
        logger.info('Auth', 'Teacher permissions enabled. Teaching management.');
      } else if (data.role === 'student') {
        logger.info('Auth', 'Student restrictions applied. Student view only.');
      } else {
        logger.warn('Auth', `Unknown role: ${data.role}`);
      }

      if (!isCorrect) {
        logger.warn('Auth', 'Login did NOT come from a real Canvas JWT. Detected source:', sourceLabel);
      } else {
        logger.info('Auth', 'All good: session authenticated against Canvas LMS via LTI 1.3.');
      }

      dispatch({ type: 'LOGIN_SUCCESS', payload: data });
    } else if (error) {
      logger.warn('Auth', "Could not verify session:", { message: error.message });
      dispatch({ type: 'LOGIN_ERROR', payload: error.message });
    }
  }, [data, error]);

  const logout = useCallback(async () => {
    try {
      await logoutToken();
      logger.info('Auth', 'LOGOUT: session closed and token removed from frontend.');
    } catch (e) {
      logger.warn('Auth', 'Backend logout failed, clearing locally:', { error: e?.message });
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
    permissions,
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
