/**
 * Base de Datos Ampliada de Pruebas (Mocks)
 */
export default class CanvasServiceMock {
  constructor(accessToken, canvasBaseUrl) {
    this.accessToken = accessToken;
    this.canvasBaseUrl = canvasBaseUrl;
  }

  async getCourses() {
    return [
      { id: 14852, name: "Ingeniería de Software II (ISWII)", course_code: "ISW2-2026" },
      { id: 14853, name: "Inteligencia Artificial (IA)", course_code: "IA-2026" },
      { id: 14854, name: "Sistemas Distribuidos (SD)", course_code: "SD-2026" }
    ];
  }

  async getAssignments(courseId) {
    const assignments = {
      14852: [
        { id: 101, name: "Examen Parcial: Arquitectura de Software", points_possible: 100 },
        { id: 102, name: "Proyecto Final: Sistema de Gestión", points_possible: 100 },
        { id: 103, name: "Control 1: Diagramas de Secuencia", points_possible: 20 }
      ],
      14853: [
        { id: 201, name: "Laboratorio 1: Redes Neuronales", points_possible: 10 },
        { id: 202, name: "Ensayo: Ética en la IA", points_possible: 5 }
      ]
    };
    return assignments[courseId] || [];
  }

  async getRubric(courseId, assignmentId) {
    return [
      { id: 'c1', description: 'Claridad en el diseño', points: 40, comments: 'Se evalúa la coherencia entre diagramas.' },
      { id: 'c2', description: 'Implementación técnica', points: 40, comments: 'Uso correcto de patrones.' },
      { id: 'c3', description: 'Documentación y estilo', points: 20, comments: 'Formato JSDoc y comentarios.' }
    ];
  }

  async getSubmission(courseId, assignmentId, studentId) {
    // Simulamos una entrega con texto real para que la IA tenga qué procesar
    return {
      body: `Este es el desarrollo de mi examen. He utilizado el patrón Singleton para la conexión a la base de datos y Factory para la creación de usuarios. 
             La arquitectura es por capas, pero tengo dudas sobre si la lógica de negocio debería estar en el modelo o en el servicio. 
             Adjunto el diagrama de clases con 15 entidades principales.`,
      score: 85,
      submitted_at: "2026-05-14T10:00:00Z"
    };
  }

  async getStudentGrades(courseId, studentId) {
    // Historial para el Validador Académico
    return [
      { grades: { current_score: 90 }, assignment_name: "Tarea 1" },
      { grades: { current_score: 85 }, assignment_name: "Tarea 2" },
      { grades: { current_score: 95 }, assignment_name: "Control 1" }
    ];
  }

  async getStudents(courseId) {
    return [
      { id: 1, name: "Juan Pérez", sortable_name: "Pérez, Juan" },
      { id: 2, name: "María García", sortable_name: "García, María" },
      { id: 3, name: "Pedro López", sortable_name: "López, Pedro" },
      { id: 4, name: "Ana Torres", sortable_name: "Torres, Ana" }
    ];
  }

  async postComment(courseId, assignmentId, studentId, comment) {
    console.log(`[MOCK-CANVAS] Comentario enviado para estudiante ${studentId}: ${comment.substring(0, 30)}...`);
    return { success: true };
  }
}
