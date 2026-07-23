import logger from '../utils/logger.js';
import { now } from '../utils/datetime.js';

// El hash se proveerá mediante .env para desarrollo local
const LOCAL_DEV_PASSWORD_HASH = process.env.LOCAL_DEV_PASSWORD_HASH || '';

const localFeedbacks = [
  { id: 1, estudiante_id: 1, curso_id: 14852, tarea_id: 101, plantilla_id: 1, contenido_generado: "Buen trabajo en la entrega. Presentas una estructura bastante sólida y bien enfocada. Sigue así.", estado: "EDITADO", calificacion_profesor: 4, calificacion_estudiante: null, fecha_generacion: now() },
  { id: 2, estudiante_id: 2, curso_id: 14852, tarea_id: 101, plantilla_id: 1, contenido_generado: "Muy buen desarrollo, demuestras un dominio sobresaliente de los conceptos de diseño y análisis.", estado: "APROBADO", calificacion_profesor: 5, calificacion_estudiante: null, fecha_generacion: now() },
  { id: 3, estudiante_id: 3, curso_id: 14852, tarea_id: 101, plantilla_id: 1, contenido_generado: "Se requiere revisión urgente de los temas de arquitectura de software para nivelar el desempeño.", estado: "RECHAZADO", calificacion_profesor: null, calificacion_estudiante: null, fecha_generacion: now() }
];

const localWebhookEvents = [];
const localApiKeys = [];
const localProfesorMetadata = [];

const localTemplates = [
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

const localCourseConfig = [];
const localAssignmentConfig = [];
const localAssignmentVariables = [];

const localUsers = [
  { id: 1, email: 'admin@canvas.local', nombre: 'Admin Sistema', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'admin', estudiante_index: null, canvas_user_id: '10000001', canvas_user_uuid: 'a6e2e413-4afb-4b60-90d1-8b0344df3e91', activo: true },
  { id: 2, email: 'profesor@canvas.local', nombre: 'Dr. Elena Ramirez', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'teacher', estudiante_index: null, canvas_user_id: '10000002', canvas_user_uuid: 'b7f3f524-5bac-4c71-91e2-9bce55ef4f02', activo: true },
  { id: 3, email: 'estudiante1@canvas.local', nombre: 'Juan Perez', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'student', estudiante_index: 1, canvas_user_id: '10000003', canvas_user_uuid: 'c8d4a635-6cad-4d82-92f3-acf66ef5a613', activo: true },
  { id: 4, email: 'estudiante2@canvas.local', nombre: 'Maria Garcia', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'student', estudiante_index: 2, canvas_user_id: '10000004', canvas_user_uuid: 'd9e5b746-7dbe-4e93-93a4-bda77be6b824', activo: true },
  { id: 5, email: 'estudiante3@canvas.local', nombre: 'Pedro Lopez', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'student', estudiante_index: 3, canvas_user_id: '10000005', canvas_user_uuid: 'e0f6c857-8ecf-4f04-94b5-ced88cf7c935', activo: true },
  { id: 6, email: 'estudiante4@canvas.local', nombre: 'Ana Torres', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'student', estudiante_index: 4, canvas_user_id: '10000006', canvas_user_uuid: 'f1a7d968-9fda-4a15-95c6-dfe99da8d046', activo: true },
  { id: 7, email: 'estudiante5@canvas.local', nombre: 'Carlos Mendez', password_hash: LOCAL_DEV_PASSWORD_HASH, rol: 'student', estudiante_index: 5, canvas_user_id: '10000007', canvas_user_uuid: 'a2b8e079-0aeb-4b26-96d7-efa00eabe157', activo: true },
];

const localCanvasTokens = [];
const localPermisosRol = [
  { rol: 'admin', permisos: { feedback: ['read', 'write', 'approve', 'delete'], templates: ['read', 'write', 'delete'], config: ['read', 'write'] } },
  { rol: 'teacher', permisos: { feedback: ['read', 'write', 'approve'], templates: ['read', 'write'], config: ['read', 'write'] } },
  { rol: 'student', permisos: { feedback: ['read'] } },
];

function sqlVerb(text) {
  const m = text.trim().match(/^(SELECT|INSERT|UPDATE|DELETE|TRUNCATE)/i);
  return m ? m[1].toUpperCase() : null;
}

function sqlTable(text) {
  // Patrones alineados con los nombres REALES que emite la capa de repositorios
  // PostgreSQL normaliza nombres sin comillas; la práctica aquí es usar los
  // nombres exactos con los que la base real crea las tablas (PascalCase).
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
      return name.toLowerCase(); // Usar lowercased para el switch
    }
  }
  return null;
}

// -- Handlers --

function handlePlantillaFeedback(verb, text, params) {
  if (verb === 'SELECT') {
    if (text.includes('WHERE id')) {
      const id = params ? params[0] : null;
      const template = localTemplates.find(t => t.id == id && !t.deleted_at);
      return { rows: template ? [template] : [] };
    }
    // Filtrar por profesor_id y excluir soft-deleted
    let rows = localTemplates.filter(t => !t.deleted_at);
    if (text.includes('profesor_id')) {
      const profId = params && params[0];
      rows = rows.filter(t => t.profesor_id == profId || t.profesor_id === null);
    }
    return { rows: [...rows] };
  }
  if (verb === 'INSERT') {
    // Detectar INSERT INTO ... SELECT (cloneDefaultTemplates)
    if (text.includes('SELECT') && text.includes('WHERE profesor_id IS NULL')) {
      const targetProfesorId = params && params[0];
      const globals = localTemplates.filter(t => t.profesor_id === null && !t.deleted_at);
      const cloned = [];
      for (const g of globals) {
        const newId = localTemplates.length > 0 ? Math.max(...localTemplates.map(t => t.id)) + 1 : 1;
        const clone = { id: newId, nombre: g.nombre, contenido: g.contenido, profesor_id: targetProfesorId, deleted_at: null };
        localTemplates.push(clone);
        cloned.push(clone);
      }
      return { rows: cloned };
    }
    // INSERT normal
    const profesorId = params.length >= 3 ? params[2] : null;
    const newTemplate = {
      id: localTemplates.length > 0 ? Math.max(...localTemplates.map(t => t.id)) + 1 : 1,
      nombre: params[0],
      contenido: params[1],
      profesor_id: profesorId,
      deleted_at: null
    };
    localTemplates.push(newTemplate);
    return { rows: [newTemplate] };
  }
  if (verb === 'UPDATE') {
    // Soft Delete: UPDATE ... SET deleted_at = NOW()
    if (text.includes('deleted_at')) {
      const id = params[0];
      const profId = params.length >= 2 ? params[1] : null;
      const template = localTemplates.find(t => t.id == id && (profId === null || t.profesor_id == profId));
      if (template) { template.deleted_at = now(); }
      return { rows: template ? [template] : [] };
    }
    // UPDATE normal (edit nombre/contenido)
    const id = params[params.length - 1];
    const template = localTemplates.find(t => t.id == id && !t.deleted_at);
    if (template) { template.nombre = params[0]; template.contenido = params[1]; template.actualizado_en = now(); }
    return { rows: template ? [template] : [] };
  }
  if (verb === 'DELETE') {
    // Hard delete fallback (para reseed u otras operaciones de limpieza)
    if (text.includes('WHERE id')) {
      const id = params[0];
      const idx = localTemplates.findIndex(t => t.id == id);
      if (idx >= 0) localTemplates.splice(idx, 1);
    } else {
      // DELETE FROM Plantilla_Feedback (sin WHERE = borrar todo)
      localTemplates.length = 0;
    }
    return { rows: [] };
  }
  return { rows: [] };
}

function handleProfesorMetadata(verb, text, params) {
  if (verb === 'SELECT') {
    const profId = params && params[0];
    const row = localProfesorMetadata.find(m => m.profesor_id == profId);
    return { rows: row ? [row] : [] };
  }
  if (verb === 'INSERT') {
    const profId = params && params[0];
    const existing = localProfesorMetadata.find(m => m.profesor_id == profId);
    if (existing) {
      // ON CONFLICT → UPDATE
      existing.has_seeded_templates = true;
      existing.actualizado_en = now();
      return { rows: [existing] };
    }
    const newRow = { profesor_id: profId, has_seeded_templates: true, actualizado_en: now() };
    localProfesorMetadata.push(newRow);
    return { rows: [newRow] };
  }
  return { rows: [] };
}

function handleHistorialAcademicoLocal(verb, text, params) {
  const studentId = params && params[0] ? parseInt(params[0]) : (text.match(/WHERE estudiante_id\s*=\s*(\d+)/i) || [0, 1])[1];
  const historyMap = {
    1: [{ grade: 9.0, date: '2026-05-01' }, { grade: 8.5, date: '2026-05-05' }, { grade: 9.5, date: '2026-05-15' }],
    2: [{ grade: 5.0, date: '2026-05-01' }, { grade: 6.0, date: '2026-05-05' }, { grade: 5.5, date: '2026-05-15' }],
    3: [{ grade: 3.5, date: '2026-05-01' }, { grade: 4.0, date: '2026-05-05' }, { grade: 3.8, date: '2026-05-15' }],
    4: [{ grade: 8.0, date: '2026-05-01' }, { grade: 8.5, date: '2026-05-05' }, { grade: 8.8, date: '2026-05-15' }],
  };
  return { rows: [{ historial_json: historyMap[studentId] || [{ grade: 5.0, date: '2026-05-01' }] }] };
}

function handleHistorialFeedbackGenerado(verb, text, params) {
  if (verb === 'INSERT') {
    const newFb = {
      id: localFeedbacks.length > 0 ? Math.max(...localFeedbacks.map(f => f.id)) + 1 : 10,
      estudiante_id: params[0], curso_id: params[1], tarea_id: params[2], plantilla_id: params[3],
      contenido_generado: params[4], prompt_usado: params[5], estado: 'PENDIENTE', fecha_generacion: now(),
      nota_canvas: params[6] || null, nota_chile: params[7] || null, aprobado: params[8] !== undefined ? params[8] : null
    };
    localFeedbacks.unshift(newFb);
    return { rows: [newFb] };
  }
  if (verb === 'SELECT') {
    let rows = [...localFeedbacks];
    if (text.includes('WHERE')) {
      if (text.includes('curso_id')) {
        const match = text.match(/curso_id\s*=\s*\$?(\d+)/i);
        if (match) rows = rows.filter(r => r.curso_id === Number(match[1]));
      }
      if (text.includes('estudiante_id')) {
        const match = text.match(/estudiante_id\s*=\s*\$?(\d+)/i);
        if (match) rows = rows.filter(r => r.estudiante_id === Number(match[1]));
      }
    }
    if (text.includes('LIMIT')) {
      const match = text.match(/LIMIT\s+(\d+)/i);
      if (match) rows = rows.slice(0, Number(match[1]));
    }
    return { rows };
  }
  if (verb === 'UPDATE') {
    if (text.includes('calificacion_profesor')) {
      const fb = localFeedbacks.find(f => f.id == params[1]);
      if (fb) fb.calificacion_profesor = params[0];
      return { rows: [fb] };
    }
    if (text.includes('calificacion_estudiante')) {
      const fb = localFeedbacks.find(f => f.id == params[1]);
      if (fb) fb.calificacion_estudiante = params[0];
      return { rows: [fb] };
    }
    const id = params[params.length - 1];
    const fb = localFeedbacks.find(f => f.id == id);
    if (fb) {
      fb.estado = params[0];
      if (params[1] !== undefined && params[1] !== null) fb.contenido_generado = params[1];
    }
    return { rows: fb ? [fb] : [] };
  }
  return { rows: [] };
}

function handleConfiguracionCursoTarea(verb, text, params) {
  const contextoTipo = params && params[0];
  const contextoId = params && params[1];
  if (verb === 'SELECT' && text.includes('WHERE')) {
    const row = localCourseConfig.find(c => c.contexto_tipo === contextoTipo && c.contexto_id === String(contextoId));
    return { rows: row ? [{ config_json: row.config_json }] : [] };
  }
  if (verb === 'INSERT') {
    const newConfig = { id: localCourseConfig.length + 1, contexto_tipo: contextoTipo, contexto_id: String(contextoId), config_json: params[2], actualizado_en: now() };
    localCourseConfig.push(newConfig);
    return { rows: [{ config_json: newConfig.config_json }] };
  }
  if (verb === 'UPDATE') {
    const existing = localCourseConfig.find(c => c.contexto_tipo === contextoTipo && c.contexto_id === String(contextoId));
    if (existing) { existing.config_json = params[0]; existing.actualizado_en = now(); }
    return { rows: existing ? [{ config_json: existing.config_json }] : [] };
  }
  return { rows: [] };
}

function handleLlavesApiIa(verb, text, params) {
  if (verb === 'SELECT') {
    const requestedService = params && params[0] ? String(params[0]).toLowerCase() : null;
    const matched = text.includes('activo = TRUE')
      ? localApiKeys.filter(k => k.activo && (!requestedService || k.servicio === requestedService))
      : localApiKeys.filter(k => !requestedService || k.servicio === requestedService);
    return { rows: matched };
  }
  if (verb === 'INSERT') {
    const newKey = { id: localApiKeys.length > 0 ? Math.max(...localApiKeys.map(k => k.id)) + 1 : 1, servicio: params[0], api_key_encriptada: params[1], activo: true };
    localApiKeys.push(newKey);
    return { rows: [newKey] };
  }
  if (verb === 'UPDATE') {
    const idx = localApiKeys.findIndex(k => k.servicio === params[0]);
    if (idx >= 0) { localApiKeys[idx].api_key_encriptada = params[1]; localApiKeys[idx].activo = true; return { rows: [localApiKeys[idx]] }; }
  }
  return { rows: [] };
}

function handleWebhookEvents(verb, text, params) {
  if (verb === 'SELECT' && text.includes('WHERE event_hash')) {
    const hash = params && params[0];
    const event = localWebhookEvents.find(ev => ev.event_hash === hash);
    return { rows: event ? [event] : [] };
  }
  if (verb === 'INSERT') {
    const hash = params[0];
    const existing = localWebhookEvents.find(ev => ev.event_hash === hash);
    if (existing) {
      existing.attempts += 1;
      return { rows: [existing] };
    }
    const newEvent = { event_hash: hash, event_type: params[1] || null, attempts: 1, processed_at: now() };
    localWebhookEvents.push(newEvent);
    return { rows: [newEvent] };
  }
  if (verb === 'DELETE') {
    const hash = params && params[0];
    const idx = localWebhookEvents.findIndex(ev => ev.event_hash === hash);
    if (idx >= 0) localWebhookEvents.splice(idx, 1);
  }
  return { rows: [] };
}

function handleConfiguracionAsignacion(verb, text, params) {
  if (verb === 'SELECT') {
    if (text.includes('WHERE canvas_course_id') && text.includes('canvas_assignment_id')) {
      const courseId = String(params[0]), assignmentId = String(params[1]);
      const row = localAssignmentConfig.find(c => c.canvas_course_id === courseId && c.canvas_assignment_id === assignmentId);
      return { rows: row ? [row] : [] };
    } else if (text.includes('WHERE canvas_course_id')) {
      const courseId = String(params[0]);
      return { rows: localAssignmentConfig.filter(c => c.canvas_course_id === courseId) };
    }
    return { rows: [...localAssignmentConfig] };
  }
  if (verb === 'INSERT') {
    const newConfig = {
      id_configuracion: localAssignmentConfig.length > 0 ? Math.max(...localAssignmentConfig.map(c => c.id_configuracion)) + 1 : 1,
      canvas_course_id: String(params[0]), canvas_assignment_id: String(params[1]), feedback_activo: params[2], plantilla_id: params[3], profesor_id: params[4], fecha_modificacion: now()
    };
    const existing = localAssignmentConfig.find(c => c.canvas_course_id === newConfig.canvas_course_id && c.canvas_assignment_id === newConfig.canvas_assignment_id);
    if (existing) { Object.assign(existing, newConfig); return { rows: [existing] }; }
    localAssignmentConfig.push(newConfig);
    return { rows: [newConfig] };
  }
  if (verb === 'UPDATE') {
    const courseId = String(params[0]), assignmentId = String(params[1]);
    const existing = localAssignmentConfig.find(c => c.canvas_course_id === courseId && c.canvas_assignment_id === assignmentId);
    if (existing) {
      if (params[2] !== undefined) existing.feedback_activo = params[2];
      if (params[3] !== undefined) existing.plantilla_id = params[3];
      if (params[4] !== undefined) existing.profesor_id = params[4];
      existing.fecha_modificacion = now();
      return { rows: [existing] };
    }
  }
  if (verb === 'DELETE') {
    const courseId = String(params[0]), assignmentId = String(params[1]);
    const idx = localAssignmentConfig.findIndex(c => c.canvas_course_id === courseId && c.canvas_assignment_id === assignmentId);
    if (idx >= 0) localAssignmentConfig.splice(idx, 1);
  }
  return { rows: [] };
}

function handleVariablesAsignacion(verb, text, params) {
  if (verb === 'SELECT') {
    if (text.includes('WHERE configuracion_id')) return { rows: localAssignmentVariables.filter(v => v.configuracion_id == params[0]) };
    return { rows: [...localAssignmentVariables] };
  }
  if (verb === 'INSERT') {
    const newVar = { id: localAssignmentVariables.length > 0 ? Math.max(...localAssignmentVariables.map(v => v.id)) + 1 : 1, configuracion_id: params[0], variable_id: params[1], variable_activa: params[2], ponderacion: params[3] };
    localAssignmentVariables.push(newVar);
    return { rows: [newVar] };
  }
  if (verb === 'DELETE') {
    if (text.includes('WHERE configuracion_id')) {
      for (let i = localAssignmentVariables.length - 1; i >= 0; i--) {
        if (localAssignmentVariables[i].configuracion_id == params[0]) localAssignmentVariables.splice(i, 1);
      }
    }
  }
  return { rows: [] };
}

function handleConfiguracionIa(verb, text, params) {
  if (verb === 'SELECT') return { rows: [{ id: 1, modelo_preferido: 'gemini-1.5-flash', prompt_base: 'Eres un asistente de feedback...', temperatura: 0.7, longitud_maxima: 2048, endpoint_api: null }] };
  return { rows: [{ id: 1, modelo_preferido: params[0] || 'gemini-1.5-flash', prompt_base: params[1] || 'Nuevo prompt', temperatura: params[2], longitud_maxima: params[3], endpoint_api: params[4] }] };
}

function handleUsuariosLocal(verb, text, params) {
  if (verb === 'SELECT') {
    if (text.includes('WHERE email')) { const user = localUsers.find(u => u.email === params[0]); return { rows: user ? [user] : [] }; }
    if (text.includes('WHERE id')) { const user = localUsers.find(u => String(u.id) === String(params[0])); return { rows: user ? [user] : [] }; }
    if (text.includes('WHERE canvas_user_id')) { const user = localUsers.find(u => u.canvas_user_id === params[0]); return { rows: user ? [user] : [] }; }
  }
  if (verb === 'INSERT') {
    const newUser = {
      id: localUsers.length > 0 ? Math.max(...localUsers.map(u => u.id)) + 1 : 1,
      email: params[0], nombre: params[1], password_hash: params[2], rol: params[3],
      estudiante_index: params[4], canvas_user_id: params[5], canvas_user_uuid: params[6],
      activo: params[7] !== false, creado_en: now(), actualizado_en: now()
    };
    const exists = localUsers.find(u => u.email === newUser.email);
    if (exists) Object.assign(exists, newUser); else localUsers.push(newUser);
    return { rows: [newUser] };
  }
  if (verb === 'UPDATE') {
    if (text.includes('WHERE email')) {
      const user = localUsers.find(u => u.email === params[0]);
      if (user) { user.nombre = params[1]; user.password_hash = params[2]; user.rol = params[3]; user.estudiante_index = params[4]; user.canvas_user_id = params[5]; user.canvas_user_uuid = params[6]; user.activo = params[7] !== false; user.actualizado_en = now(); }
      return { rows: user ? [user] : [] };
    }
    if (text.includes('WHERE id')) {
      const user = localUsers.find(u => String(u.id) === String(params[params.length - 1]));
      if (user) { user.nombre = params[0]; user.password_hash = params[1]; user.rol = params[2]; user.estudiante_index = params[3]; user.canvas_user_id = params[4]; user.canvas_user_uuid = params[5]; user.activo = params[6] !== false; user.actualizado_en = now(); }
      return { rows: user ? [user] : [] };
    }
  }
  if (verb === 'DELETE') {
    if (text.includes('WHERE email')) { const idx = localUsers.findIndex(u => u.email === params[0]); if (idx >= 0) localUsers.splice(idx, 1); }
    if (text.includes('WHERE id')) { const idx = localUsers.findIndex(u => String(u.id) === String(params[0])); if (idx >= 0) localUsers.splice(idx, 1); }
  }
  return { rows: [] };
}

function handlePermisosRol(verb, text, params) {
  if (verb === 'SELECT') {
    if (text.includes('WHERE rol')) {
      const rol = params && params[0];
      return { rows: localPermisosRol.filter(p => p.rol === rol) };
    }
    return { rows: [...localPermisosRol] };
  }
  if (verb === 'INSERT' || verb === 'UPDATE') {
    const rol = params && params[0];
    const permisos = params && params[1];
    const existing = localPermisosRol.find(p => p.rol === rol);
    if (existing) { existing.permisos = permisos; }
    else { localPermisosRol.push({ rol, permisos }); }
    return { rows: [{ rol, permisos }] };
  }
  return { rows: [] };
}

function handleCanvasUserTokens(verb, text, params) {
  if (verb === 'SELECT') {
    const sub = params && params[0];
    return { rows: localCanvasTokens.filter(t => t.canvas_sub === sub) };
  }
  if (verb === 'INSERT' || verb === 'UPDATE') {
    const sub = params && params[0];
    const access_token = params && params[1];
    const refresh_token = params && params[2];
    const expires_at = params && params[3];
    const existing = localCanvasTokens.find(t => t.canvas_sub === sub);
    if (existing) {
      existing.access_token = access_token;
      existing.refresh_token = refresh_token;
      existing.expires_at = expires_at;
    } else {
      localCanvasTokens.push({ canvas_sub: sub, access_token, refresh_token, expires_at });
    }
    return { rows: [{ canvas_sub: sub, access_token, refresh_token, expires_at }] };
  }
  if (verb === 'DELETE') {
    const sub = params && params[0];
    const idx = localCanvasTokens.findIndex(t => t.canvas_sub === sub);
    if (idx >= 0) localCanvasTokens.splice(idx, 1);
    return { rows: [] };
  }
  return { rows: [] };
}

export const localDb = {
  query: async (text, params) => {
    logger.debug(`[DB-LOCAL] Ejecutando: ${text.substring(0, 100)}...`);
    const verb = sqlVerb(text);
    const table = sqlTable(text);

    if (verb === 'TRUNCATE') return { rows: [], rowCount: 0 };

    switch (table) {
      case 'plantilla_feedback': return handlePlantillaFeedback(verb, text, params);
      case 'historial_academico_local': return handleHistorialAcademicoLocal(verb, text, params);
      case 'historial_feedback_generado': return handleHistorialFeedbackGenerado(verb, text, params);
      case 'configuracion_curso_tarea': return handleConfiguracionCursoTarea(verb, text, params);
      case 'llaves_api_ia': return handleLlavesApiIa(verb, text, params);
      case 'logs_auditoria': return { rows: verb === 'INSERT' ? [{ id: Date.now() }] : [] };
      case 'notificaciones_feedback': return { rows: verb === 'INSERT' ? [{ id: Date.now() }] : [] };
      case 'webhook_events': return handleWebhookEvents(verb, text, params);
      case 'configuracion_asignacion': return handleConfiguracionAsignacion(verb, text, params);
      case 'variables_asignacion': return handleVariablesAsignacion(verb, text, params);
      case 'configuracion_ia': return handleConfiguracionIa(verb, text, params);
      case 'usuarios_local': return handleUsuariosLocal(verb, text, params);
      case 'user_lti_mappings': return { rows: verb === 'INSERT' ? [{ id: Date.now(), local_user_id: params[0], canvas_sub: params[1], canvas_uuid: params[2], deployment_id: params[3], issuer: params[4] }] : [] };
      case 'permisos_rol': return handlePermisosRol(verb, text, params);
      case 'canvas_user_tokens': return handleCanvasUserTokens(verb, text, params);
      case 'profesor_metadata': return handleProfesorMetadata(verb, text, params);
      default: return { rows: [], rowCount: 0 };
    }
  },

  beginTransaction() {
    this._snapshot = {
      localFeedbacks: localFeedbacks.map(f => ({ ...f })),
      localWebhookEvents: localWebhookEvents.map(e => ({ ...e })),
      localApiKeys: localApiKeys.map(k => ({ ...k })),
      localTemplates: localTemplates.map(t => ({ ...t })),
      localCourseConfig: localCourseConfig.map(c => ({ ...c })),
      localAssignmentConfig: localAssignmentConfig.map(c => ({ ...c })),
      localAssignmentVariables: localAssignmentVariables.map(v => ({ ...v })),
      localUsers: localUsers.map(u => ({ ...u })),
      localProfesorMetadata: localProfesorMetadata.map(m => ({ ...m })),
    };
  },

  commit() {
    this._snapshot = null;
  },

  rollback() {
    if (!this._snapshot) return;
    const snap = this._snapshot;
    localFeedbacks.length = 0; localFeedbacks.push(...snap.localFeedbacks);
    localWebhookEvents.length = 0; localWebhookEvents.push(...snap.localWebhookEvents);
    localApiKeys.length = 0; localApiKeys.push(...snap.localApiKeys);
    localTemplates.length = 0; localTemplates.push(...snap.localTemplates);
    localCourseConfig.length = 0; localCourseConfig.push(...snap.localCourseConfig);
    localAssignmentConfig.length = 0; localAssignmentConfig.push(...snap.localAssignmentConfig);
    localAssignmentVariables.length = 0; localAssignmentVariables.push(...snap.localAssignmentVariables);
    localUsers.length = 0; localUsers.push(...snap.localUsers);
    localProfesorMetadata.length = 0; localProfesorMetadata.push(...snap.localProfesorMetadata);
    this._snapshot = null;
  }
};
