import logger from '../utils/logger.js';
import { now } from '../utils/datetime.js';

// El hash se proveerá mediante .env para desarrollo local
export const LOCAL_DEV_PASSWORD_HASH = process.env.LOCAL_DEV_PASSWORD_HASH || '';

export const localFeedbacks = [
  { id: 1, estudiante_id: 1, curso_id: 14852, tarea_id: 101, plantilla_id: 1, contenido_generado: "Buen trabajo en la entrega. Presentas una estructura bastante sólida y bien enfocada. Sigue así.", estado: "EDITADO", calificacion_profesor: 4, calificacion_estudiante: null, fecha_generacion: now() },
  { id: 2, estudiante_id: 2, curso_id: 14852, tarea_id: 101, plantilla_id: 1, contenido_generado: "Muy buen desarrollo, demuestras un dominio sobresaliente de los conceptos de diseño y análisis.", estado: "APROBADO", calificacion_profesor: 5, calificacion_estudiante: null, fecha_generacion: now() },
  { id: 3, estudiante_id: 3, curso_id: 14852, tarea_id: 101, plantilla_id: 1, contenido_generado: "Se requiere revisión urgente de los temas de arquitectura de software para nivelar el desempeño.", estado: "RECHAZADO", calificacion_profesor: null, calificacion_estudiante: null, fecha_generacion: now() }
];

export const localWebhookEvents = [];
export const localApiKeys = [];
export const localProfesorMetadata = [];

export const localTemplates = [
  {
    id: 1,
    nombre: 'Clase Estándar',
    profesor_id: null,
    deleted_at: null,
    contenido: JSON.stringify({
      alto: 'Estimado/a {{nombre_estudiante}},\n\nTu calificación es {{calificacion}}.\n\nLo has hecho muy bien, excelente trabajo.\n\nSaludos cordiales,\nProfesor',
      medio: 'Estimado/a {{nombre_estudiante}},\n\nTu calificación es {{calificacion}}.\n\nHas hecho un trabajo más o menos adecuado, pero hay aspectos que puedes mejorar.\n\nSaludos cordiales,\nProfesor',
      bajo: 'Estimado/a {{nombre_estudiante}},\n\nTu calificación es {{calificacion}}.\n\nPor favor, es necesario que le pongas mayor esfuerzo. Consulta el material para mejorar.\n\nSaludos cordiales,\nProfesor'
    })
  },
  {
    id: 2,
    nombre: 'Feedback Detallado',
    profesor_id: null,
    deleted_at: null,
    contenido: JSON.stringify({
      alto: 'Estimado/a {{nombre_estudiante}},\n\nTu calificación es {{calificacion}}. Has demostrado un dominio sobresaliente de los conceptos, con una base muy sólida que demuestra un gran nivel de comprensión y dedicación.\n\n¡Sigue así, excelente desempeño!\n\nSaludos,\nProfesor',
      medio: 'Estimado/a {{nombre_estudiante}},\n\nTu calificación es {{calificacion}}. Tienes una buena base, pero existen áreas específicas que debemos reforzar para alcanzar un dominio completo de los temas tratados en esta evaluación.\n\nTe animo a revisar el material de estudio.\n\nSaludos,\nProfesor',
      bajo: 'Estimado/a {{nombre_estudiante}},\n\nTu calificación es {{calificacion}}. Es fundamental que repasemos el contenido visto en clase, ya que se evidencian conceptos clave que aún no están afianzados.\n\nPor favor, contáctame para aclarar dudas o asiste a las horas de tutoría.\n\nSaludos,\nProfesor'
    })
  },
  {
    id: 3,
    nombre: 'Evaluación Cruzada',
    profesor_id: null,
    deleted_at: null,
    contenido: JSON.stringify({
      alto: 'Hola {{nombre_estudiante}},\n\nTu calificación es {{calificacion}}. Tus compañeros y yo coincidimos en que tu trabajo es destacado y aporta gran valor a la revisión entre pares.\n\n¡Felicidades!\n\nSaludos,\nProfesor',
      medio: 'Hola {{nombre_estudiante}},\n\nTu calificación es {{calificacion}}. Según la evaluación cruzada, tu desempeño es promedio, presentando un trabajo adecuado pero con oportunidades de mejora identificadas por tus pares.\n\n¡Sigue trabajando!\n\nSaludos,\nProfesor',
      bajo: 'Hola {{nombre_estudiante}},\n\nTu calificación es {{calificacion}}. La revisión cruzada indica que hay debilidades importantes en tu entrega que deben ser atendidas, según el consenso de la coevaluación.\n\nRevisa los comentarios de tus compañeros.\n\nSaludos,\nProfesor'
    })
  }
];

export const localCourseConfig = [];
export const localAssignmentConfig = [];
export const localAssignmentVariables = [];

export const localUsers = [
  { id: 1, email: 'admin@canvas.local', nombre: 'Admin Sistema', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'admin', estudiante_index: null, canvas_user_id: '10000001', canvas_user_uuid: 'a6e2e413-4afb-4b60-90d1-8b0344df3e91', activo: true },
  { id: 2, email: 'profesor@canvas.local', nombre: 'Dr. Elena Ramirez', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'teacher', estudiante_index: null, canvas_user_id: '10000002', canvas_user_uuid: 'b7f3f524-5bac-4c71-91e2-9bce55ef4f02', activo: true },
  { id: 3, email: 'estudiante1@canvas.local', nombre: 'Juan Perez', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'student', estudiante_index: 1, canvas_user_id: '10000003', canvas_user_uuid: 'c8d4a635-6cad-4d82-92f3-acf66ef5a613', activo: true },
  { id: 4, email: 'estudiante2@canvas.local', nombre: 'Maria Garcia', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'student', estudiante_index: 2, canvas_user_id: '10000004', canvas_user_uuid: 'd9e5b746-7dbe-4e93-93a4-bda77be6b824', activo: true },
  { id: 5, email: 'estudiante3@canvas.local', nombre: 'Pedro Lopez', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'student', estudiante_index: 3, canvas_user_id: '10000005', canvas_user_uuid: 'e0f6c857-8ecf-4f04-94b5-ced88cf7c935', activo: true },
  { id: 6, email: 'estudiante4@canvas.local', nombre: 'Ana Torres', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'student', estudiante_index: 4, canvas_user_id: '10000006', canvas_user_uuid: 'f1a7d968-9fda-4a15-95c6-dfe99da8d046', activo: true },
  { id: 7, email: 'estudiante5@canvas.local', nombre: 'Carlos Mendez', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'student', estudiante_index: 5, canvas_user_id: '10000007', canvas_user_uuid: 'a2b8e079-0aeb-4b26-96d7-efa00eabe157', activo: true },
];

export const localCanvasTokens = [];
export const localPermisosRol = [
  { rol: 'admin', permisos: { feedback: ['read', 'write', 'approve', 'delete'], templates: ['read', 'write', 'delete'], config: ['read', 'write'] } },
  { rol: 'teacher', permisos: { feedback: ['read', 'write', 'approve'], templates: ['read', 'write'], config: ['read', 'write'] } },
  { rol: 'student', permisos: { feedback: ['read'] } },
];

export function sqlVerb(text) {
  const m = text.trim().match(/^(SELECT|INSERT|UPDATE|DELETE|TRUNCATE)/i);
  return m ? m[1].toUpperCase() : null;
}

export function sqlTable(text) {
  const patterns = [
    ['Plantilla_Feedback', /plantilla_feedback/i],
    ['Historial_Feedback_Generado', /historial_feedback_generado/i],
    ['Historial_Academico_Local', /historial_academico_local/i],
    ['Configuracion_Curso_Tarea', /configuracion_curso_tarea/i],
    ['Llaves_API_IA', /llaves_api_ia/i],
    ['Logs_Auditoria', /logs_auditoria/i],
    ['Notificaciones_Feedback', /notificaciones_feedback/i],
    ['webhook_events', /webhook_events/i],
    ['configuracion_asignacion', /configuracion_asignacion/i],
    ['variables_asignacion', /variables_asignacion/i],
    ['Configuracion_IA', /configuracion_ia/i],
    ['usuarios_local', /usuarios_local/i],
    ['user_lti_mappings', /user_lti_mappings/i],
    ['Permisos_Rol', /permisos_rol/i],
    ['canvas_user_tokens', /canvas_user_tokens/i],
    ['schema_migrations', /schema_migrations/i],
    ['profesor_metadata', /profesor_metadata/i],
  ];
  for (const [name, p] of patterns) {
    if (p.test(text)) {
      return name.toLowerCase();
    }
  }
  return null;
}
