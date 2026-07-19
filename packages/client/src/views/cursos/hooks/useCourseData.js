import { useState, useEffect, useRef } from "react";
import { api } from "shared/api";
import logger from "../../../utils/logger";

export function useCourseData(onApiError) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [retrying, setRetrying] = useState(false);
  const [syncTime, setSyncTime] = useState("---");
  const inFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let attempt = 0;
    const MAX_ATTEMPTS = 3;

    const fetchCourses = async () => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      setLoading(true);
      setError(null);
      try {
        const json = await api.get('/courses');

        if (!json.exito) {
          throw new Error(json.error || 'Error al obtener cursos');
        }

        if (cancelled) return;
        const data = json.data || [];
        const filteredCourses = data.filter(c => c.name).map(c => ({
          id: c.id,
          name: c.name,
          term: c.course_code || "N/A"
        }));
        setCourses(filteredCourses);
        setSyncTime(new Date().toLocaleTimeString());
      } catch (err) {
        logger.warn('CourseSelector', "Error al conectar con la API de Canvas.", { error: err });
        if (cancelled) return;
        if (onApiError) {
          onApiError();
          return;
        }
        // Backoff: reintenta con espera creciente antes de mostrar error fatal.
        if (attempt < MAX_ATTEMPTS - 1) {
          attempt += 1;
          setRetrying(true);
          const delay = 1000 * attempt;
          setTimeout(() => { inFlightRef.current = false; fetchCourses(); }, delay);
          return;
        }
        setError("Error al conectar con la API de Canvas. Verifique que el backend tenga un token válido de Canvas.");
      } finally {
        if (!cancelled) setLoading(false);
        inFlightRef.current = false;
      }
    };

    fetchCourses();
    return () => { cancelled = true; };
  }, [onApiError]);

  return { courses, loading, error, retrying, syncTime };
}
