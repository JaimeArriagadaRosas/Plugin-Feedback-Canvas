/**
 * Base de Datos Ampliada de Pruebas (Mocks) — Exámenes con Preguntas Reales
 * Formato compatible con Canvas LMS: preguntas de selección múltiple,
 * respuesta correcta, puntaje por pregunta y detalle de aciertos/errores.
 */
export default class CanvasServiceMock {
  constructor(accessToken, canvasBaseUrl) {
    this.accessToken = accessToken;
    this.canvasBaseUrl = canvasBaseUrl;
  }

  // ──────────────────────────────────────────────
  // CURSOS
  // ──────────────────────────────────────────────
  async getCourses() {
    return [
      { id: 14852, name: "Ingeniería de Software II (ISWII)", course_code: "ISW2-2026" },
      { id: 14853, name: "Inteligencia Artificial (IA)", course_code: "IA-2026" },
      { id: 14854, name: "Sistemas Distribuidos (SD)", course_code: "SD-2026" }
    ];
  }

  // ──────────────────────────────────────────────
  // TAREAS / EXÁMENES
  // ──────────────────────────────────────────────
  async getAssignments(courseId) {
    const assignments = {
      14852: [
        {
          id: 101,
          name: "Examen Parcial: Arquitectura de Software",
          points_possible: 100,
          description: "Examen de 10 preguntas de selección múltiple sobre patrones de diseño, arquitectura en capas y documentación.",
          num_questions: 10,
          points_per_question: 10
        },
        {
          id: 102,
          name: "Proyecto Final: Sistema de Gestión",
          points_possible: 100,
          description: "Proyecto práctico — evaluación por rúbrica.",
          num_questions: null,
          points_per_question: null
        },
        {
          id: 103,
          name: "Control 1: Diagramas de Secuencia",
          points_possible: 20,
          description: "Preguntas teóricas sobre UML.",
          num_questions: 5,
          points_per_question: 4
        }
      ],
      14853: [
        {
          id: 201,
          name: "Laboratorio 1: Redes Neuronales",
          points_possible: 10,
          description: "Laboratorio práctico de redes neuronales.",
          num_questions: null,
          points_per_question: null
        },
        {
          id: 202,
          name: "Ensayo: Ética en la IA",
          points_possible: 5,
          description: "Ensayo corto sobre ética en IA.",
          num_questions: null,
          points_per_question: null
        }
      ]
    };
    return assignments[courseId] || [];
  }

  // ──────────────────────────────────────────────
  // RÚBRICA (igual para todos los exámenes)
  // ──────────────────────────────────────────────
  async getAssignment(courseId, assignmentId) {
    const assignments = this.getAssignments(courseId);
    // In the mock we must await because getAssignments is async
    const list = await this.getAssignments(courseId);
    const found = list.find(a => a.id === assignmentId);
    return found || { id: assignmentId, name: `Tarea ${assignmentId}`, points_possible: 100, description: '' };
  }

  // ──────────────────────────────────────────────
  // RÚBRICA (igual para todos los exámenes)
  // ──────────────────────────────────────────────
  async getRubric(courseId, assignmentId) {
    return [
      { id: 'c1', description: 'Claridad en el diseño', points: 40, comments: 'Se evalúa la coherencia entre diagramas y la elección de patrones.' },
      { id: 'c2', description: 'Implementación técnica', points: 40, comments: 'Uso correcto de patrones de diseño y arquitectura en capas.' },
      { id: 'c3', description: 'Documentación y estilo', points: 20, comments: 'Formato JSDoc y comentarios descriptivos en el código.' }
    ];
  }

  // ──────────────────────────────────────────────
  // PREGUNTAS DEL EXAMEN
  // ──────────────────────────────────────────────
  /**
   * Preguntas de selección múltiple — Formato Canvas LMS (Quiz Questions)
   * Cada pregunta trae: id, texto, opciones (A/B/C/D), respuesta_correcta y puntaje.
   */
  async getQuizQuestions(courseId, assignmentId) {
    const examQuestions = {
      101: [
        {
          id: 'q1',
          text: '¿Cuál de los siguientes patrones de diseño garantiza que una clase tenga una única instancia?',
          options: {
            A: 'Factory Method',
            B: 'Singleton',
            C: 'Observer',
            D: 'Strategy'
          },
          correct_answer: 'B',
          points: 10
        },
        {
          id: 'q2',
          text: '¿Qué patrón se usa para crear familias de objetos relacionados sin especificar sus clases concretas?',
          options: {
            A: 'Abstract Factory',
            B: 'Builder',
            C: 'Prototype',
            D: 'Adapter'
          },
          correct_answer: 'A',
          points: 10
        },
        {
          id: 'q3',
          text: 'En una arquitectura en capas, ¿dónde se ubica la lógica de negocio?',
          options: {
            A: 'Capa de presentación',
            B: 'Capa de datos',
            C: 'Capa de servicios / dominio',
            D: 'Capa de infraestructura'
          },
          correct_answer: 'C',
          points: 10
        },
        {
          id: 'q4',
          text: '¿Qué diagrama UML es más apropiado para modelar las relaciones entre clases?',
          options: {
            A: 'Diagrama de Casos de Uso',
            B: 'Diagrama de Clases',
            C: 'Diagrama de Secuencia',
            D: 'Diagrama de Actividades'
          },
          correct_answer: 'B',
          points: 10
        },
        {
          id: 'q5',
          text: 'El patrón Observer es útil cuando:',
          options: {
            A: 'Se necesita crear objetos clonando una instancia base',
            B: 'Varios objetos deben ser notificados cuando el estado de otro cambia',
            C: 'Se quiere separar la construcción de un objeto complejo de su representación',
            D: 'Se necesita adaptar la interfaz de una clase para que otra la use'
          },
          correct_answer: 'B',
          points: 10
        },
        {
          id: 'q6',
          text: '¿Qué principio SOLID establece que las clases deben depender de abstracciones y no de implementaciones concretas?',
          options: {
            A: 'Open/Closed',
            B: 'Liskov Substitution',
            C: 'Dependency Inversion',
            D: 'Interface Segregation'
          },
          correct_answer: 'C',
          points: 10
        },
        {
          id: 'q7',
          text: 'En REST, ¿qué método HTTP se usa para actualizar un recurso existente completamente?',
          options: {
            A: 'GET',
            B: 'POST',
            C: 'PUT',
            D: 'PATCH'
          },
          correct_answer: 'C',
          points: 10
        },
        {
          id: 'q8',
          text: 'Una API Gateway sirve principalmente para:',
          options: {
            A: 'Almacenar datos de sesión',
            B: 'Enrutar, autenticar y monitorear solicitudes a microservicios',
            C: 'Compilar código fuente',
            D: 'Gestionar la base de datos'
          },
          correct_answer: 'B',
          points: 10
        },
        {
          id: 'q9',
          text: 'En JSDoc, ¿cómo se documenta el parámetro de una función?',
          options: {
            A: '@param {tipo} nombre descripción',
            B: '@arg {tipo} nombre descripción',
            C: '@parameter {tipo} nombre',
            D: '@variable {tipo} nombre'
          },
          correct_answer: 'A',
          points: 10
        },
        {
          id: 'q10',
          text: 'El acoplamiento alto entre módulos implica:',
          options: {
            A: 'Mayor facilidad para modificar y reutilizar código',
            B: 'Menor dependencia entre módulos',
            C: 'Mayor dificultad para realizar cambios sin afectar otros módulos',
            D: 'Ningún impacto en el mantenimiento'
          },
          correct_answer: 'C',
          points: 10
        }
      ]
    };
    return examQuestions[assignmentId] || [];
  }

  // ──────────────────────────────────────────────
  // ENTREGAS — ahora con detalle de preguntas y calificaciones reales por estudiante
  // ──────────────────────────────────────────────
  async getSubmission(courseId, assignmentId, studentId) {
    // Detalle de respuestas por estudiante: pregunta_id → respuesta_elegida
    const studentAnswers = {
      1: { q1: 'A', q2: 'A', q3: 'C', q4: 'B', q5: 'B', q6: 'C', q7: 'C', q8: 'B', q9: 'A', q10: 'C' }, // 9/10 = 90 pts
      2: { q1: 'B', q2: 'A', q3: 'A', q4: 'C', q5: 'B', q6: 'A', q7: 'D', q8: 'B', q9: 'A', q10: 'B' }, // 5/10 = 50 pts
      3: { q1: 'B', q2: 'B', q3: 'C', q4: 'B', q5: 'D', q6: 'C', q7: 'A', q8: 'C', q9: 'B', q10: 'C' }, // 4/10 = 40 pts
      4: { q1: 'B', q2: 'A', q3: 'C', q4: 'B', q5: 'B', q6: 'C', q7: 'C', q8: 'B', q9: 'A', q10: 'D' }, // 8/10 = 80 pts
      5: { q1: 'B', q2: 'A', q3: 'C', q4: 'B', q5: 'B', q6: 'C', q7: 'C', q8: 'B', q9: 'A', q10: 'C' }, // 10/10 = 100 pts
    };

    const questions = await this.getQuizQuestions(courseId, assignmentId);
    const answers = studentAnswers[studentId] || {};
    let canvasScore = 0;
    const answeredQuestions = [];

    for (const q of questions) {
      const studentAnswer = answers[q.id];
      const isCorrect = studentAnswer === q.correct_answer;
      if (isCorrect) canvasScore += q.points;

      answeredQuestions.push({
        id: q.id,
        text: q.text,
        options: q.options,
        correct_answer: q.correct_answer,
        student_answer: studentAnswer || 'No respondida',
        is_correct: isCorrect,
        points_earned: isCorrect ? q.points : 0,
        points_possible: q.points
      });
    }

    const answeredCount = questions.length;
    const correctCount = answeredQuestions.filter(q => q.is_correct).length;
    const incorrectCount = answeredCount - correctCount;

    return {
      body: `Respuestas del examen generadas automáticamente. Preguntas respondidas: ${answeredCount}, Aciertos: ${correctCount}, Errores: ${incorrectCount}.`,
      score: canvasScore,
      submitted_at: "2026-05-14T10:00:00Z",
      questions: answeredQuestions,
      total_questions: answeredCount,
      correct_count: correctCount,
      incorrect_count: incorrectCount,
      accuracy_percent: Math.round((correctCount / answeredCount) * 100)
    };
  }

  async getStudentGrades(courseId, studentId) {
    const historyByStudent = {
      1: [ // Juan Pérez
        { grades: { current_score: 90 }, assignment_name: "Tarea 1" },
        { grades: { current_score: 85 }, assignment_name: "Tarea 2" },
        { grades: { current_score: 95 }, assignment_name: "Control 1" }
      ],
      2: // María García
        [ { grades: { current_score: 50 }, assignment_name: "Tarea 1" },
          { grades: { current_score: 60 }, assignment_name: "Tarea 2" },
          { grades: { current_score: 55 }, assignment_name: "Control 1" } ],
      3: // Pedro López
        [ { grades: { current_score: 40 }, assignment_name: "Tarea 1" },
          { grades: { current_score: 35 }, assignment_name: "Tarea 2" },
          { grades: { current_score: 45 }, assignment_name: "Control 1" } ],
      4: // Ana Torres
        [ { grades: { current_score: 80 }, assignment_name: "Tarea 1" },
          { grades: { current_score: 85 }, assignment_name: "Tarea 2" },
          { grades: { current_score: 88 }, assignment_name: "Control 1" } ],
      5: // Carlos Méndez
        [ { grades: { current_score: 92 }, assignment_name: "Tarea 1" },
          { grades: { current_score: 90 }, assignment_name: "Tarea 2" },
          { grades: { current_score: 94 }, assignment_name: "Control 1" } ],
    };
    return historyByStudent[studentId] || [];
  }

  async getStudents(courseId) {
    return [
      { id: 1, name: "Juan Pérez", sortable_name: "Pérez, Juan" },
      { id: 2, name: "María García", sortable_name: "García, María" },
      { id: 3, name: "Pedro López", sortable_name: "López, Pedro" },
      { id: 4, name: "Ana Torres", sortable_name: "Torres, Ana" },
      { id: 5, name: "Carlos Méndez", sortable_name: "Méndez, Carlos" }
    ];
  }

  async postComment(courseId, assignmentId, studentId, comment) {
    console.log(`[MOCK-CANVAS] Comentario enviado para estudiante ${studentId}: ${comment.substring(0, 60)}...`);
    return { success: true };
  }
}
