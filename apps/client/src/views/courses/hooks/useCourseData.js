/**
 * useCourseData — Loads the teacher's courses from the Canvas API.
 *
 * Uses React Query (useQuery) to handle loading, caching, and errors.
 * This eliminates the complexity of the manual hook with useEffect + cancelled ref
 * that caused infinite loops when the parent component passed an inline function
 * like onApiError (new reference on each render).
 */
import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from '@/api';
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
      logger.info("CourseData", "Requesting courses from backend...");
      const json = await api.get("/courses");

      if (!json || !json.exito) {
        throw new Error(json?.error?.mensaje || json?.mensaje || "Error fetching courses");
      }

      const raw = json.data || [];
      const courses = raw.filter((c) => c.name).map(mapCourse);

      logger.info("CourseData", `Courses received: ${courses.length}`);
      return courses;
    },
    staleTime: 5 * 60 * 1000,   // 5 min — no re-fetch on navigation
    gcTime: 10 * 60 * 1000,     // 10 min in cache after unmounting
    retry: (failureCount, err) => {
      const status = err?.status;
      // Do not retry on auth/permissions errors
      if (status === 401 || status === 403) return false;
      return failureCount < 2;
    },
    // Notify errors to parent without altering hook dependencies
    throwOnError: false,
  });

  // Propagate error to parent (onApiError is only notification, it does not control state)
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
          ? "Invalid or expired LTI session. Please reload the plugin from Canvas."
          : error?.status === 403
          ? "Your account does not have instructor permissions to view courses."
          : "Error connecting to Canvas API.")
      : null,
    retrying: false,
    retryCountdown: null,
    syncTime: new Date().toLocaleTimeString(),
    usingCache: false,
    invalidateCache,
  };
}
