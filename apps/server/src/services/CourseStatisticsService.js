/**
 * CourseStatisticsService - Calcula el promedio y tendencias de un curso de forma semántica.
 */
export default class CourseStatisticsService {
  constructor(canvasGateway) {
    this.canvasGateway = canvasGateway;
  }

  /**
   * Obtiene y procesa las calificaciones del curso para devolver una frase semántica
   * que se inyectará en la variable {{promedio_curso}}.
   */
  async getSemanticCourseAverage(courseId, teacherId) {
    try {
      // Intentamos obtener todos los estudiantes y sus entregas.
      // Dependiendo de la eficiencia, podríamos usar un endpoint de analytics de Canvas,
      // pero por ahora usaremos una aproximación asumiendo que CanvasGateway puede darnos un resumen.
      
      // Simulamos la lógica real por ahora hasta que expandamos CanvasGateway:
      // Lo ideal es: this.canvasGateway.getCourseAnalytics(courseId) 
      // o consultar todas las notas y promediarlas.
      
      // Para efectos de implementación de Fase 7, dejaremos una estructura modular.
      const hasEnoughData = true; // TODO: Implementar validación real de cantidad de datos
      const hasGrades = false; // TODO: Determinar si el profesor califica con notas (1-7) o puntajes
      const averageScore = 75; // TODO: Calcular real
      const averageGrade = 5.5; // TODO: Calcular real

      if (!hasEnoughData) {
        return 'los primeros resultados del curso, indicando una tendencia inicial';
      }

      if (hasGrades) {
        return `el promedio general del curso de ${averageGrade}`;
      } else {
        return `el puntaje promedio del curso de ${averageScore} sobre 100`;
      }
    } catch (error) {
      // Si falla por alguna razón (red, permisos), fallback a una frase neutra
      return 'el promedio actual del curso';
    }
  }
}
