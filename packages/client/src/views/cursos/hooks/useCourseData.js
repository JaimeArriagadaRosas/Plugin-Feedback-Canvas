/**
 * useCourseData — Carga los cursos del profesor desde la API de Canvas.
 *
 * Usa React Query (useQuery) para manejar loading, caching, y errores.
 * Esto elimina la complejidad del hook manual con useEffect + cancelled ref
 * que causaba bucles infinitos cuando el componente padre pasaba una función
 * inline como onApiError (nueva referencia en cada render).
 */
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "shared/api";
import logger from "../../../utils/logger";

const QUERY_KEY = ["courses", "teacher"];

function mapCourse(c) {
  return {
    id: c.id,
    name: c.name,
    term: c.course_code || "N/A",
  };
}

export function useCourseData(onApiError) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, isError } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      logger.info("CourseData", "Solicitando cursos al backend...");
      const json = await api.get("/courses");

      if (!json || !json.exito) {
        throw new Error(json?.error?.mensaje || json?.mensaje || "Error al obtener cursos");
      }

      const raw = json.data || [];
      const courses = raw.filter((c) => c.name).map(mapCourse);

      logger.info("CourseData", `Cursos recibidos: ${courses.length}`);
      return courses;
    },
    staleTime: 5 * 60 * 1000,   // 5 min — no re-fetch en navegación
    gcTime: 10 * 60 * 1000,     // 10 min en caché después de desmontar
    retry: (failureCount, err) => {
      const status = err?.status;
      // No reintentar en errores de auth/permisos
      if (status === 401 || status === 403) return false;
      return failureCount < 2;
    },
    // Notificar errores al padre sin alterar las dependencias del hook
    throwOnError: false,
  });

  // Propagar error al padre (onApiError es solo notificación, no controla el estado)
  if (isError && error && onApiError) {
    onApiError(error);
  }

  const invalidateCache = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);

  const courses = data || [];

  return {
    courses,
    loading: isLoading,
    error: isError
      ? (error?.status === 401
          ? "Sesión LTI inválida o expirada. Por favor, recargue el plugin desde Canvas."
          : error?.status === 403
          ? "Su cuenta no tiene permisos de profesor para ver cursos."
          : "Error al conectar con la API de Canvas.")
      : null,
    retrying: false,
    retryCountdown: null,
    syncTime: new Date().toLocaleTimeString(),
    usingCache: false,
    invalidateCache,
  };
}
