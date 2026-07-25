import { localTemplates, localFeedbacks, localProfesorMetadata, localCourseConfig, localAssignmentConfig, localAssignmentVariables } from './dbConnection.js';
import { now } from '../utils/datetime.js';

export function handlePlantillaFeedback(verb, text, params) {
  if (verb === 'SELECT') {
    if (text.includes('WHERE id')) {
      const id = params ? params[0] : null;
      const template = localTemplates.find(t => t.id == id && !t.deleted_at);
      return { rows: template ? [template] : [] };
    }
    let rows = localTemplates.filter(t => !t.deleted_at);
    if (text.includes('profesor_id')) {
      const profId = params && params[0];
      rows = rows.filter(t => t.profesor_id == profId || t.profesor_id === null);
    }
    return { rows: [...rows] };
  }
  if (verb === 'INSERT') {
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
    if (text.includes('deleted_at')) {
      const id = params[0];
      const profId = params.length >= 2 ? params[1] : null;
      const template = localTemplates.find(t => t.id == id && (profId === null || t.profesor_id == profId));
      if (template) { template.deleted_at = now(); }
      return { rows: template ? [template] : [] };
    }
    const id = params[params.length - 1];
    const template = localTemplates.find(t => t.id == id && !t.deleted_at);
    if (template) { template.nombre = params[0]; template.contenido = params[1]; template.actualizado_en = now(); }
    return { rows: template ? [template] : [] };
  }
  if (verb === 'DELETE') {
    if (text.includes('WHERE id')) {
      const id = params[0];
      const idx = localTemplates.findIndex(t => t.id == id);
      if (idx >= 0) localTemplates.splice(idx, 1);
    } else {
      localTemplates.length = 0;
    }
    return { rows: [] };
  }
  return { rows: [] };
}

export function handleProfesorMetadata(verb, text, params) {
  if (verb === 'SELECT') {
    const profId = params && params[0];
    const row = localProfesorMetadata.find(m => m.profesor_id == profId);
    return { rows: row ? [row] : [] };
  }
  if (verb === 'INSERT') {
    const profId = params && params[0];
    const existing = localProfesorMetadata.find(m => m.profesor_id == profId);
    if (existing) {
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

export function handleHistorialFeedbackGenerado(verb, text, params) {
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

export function handleConfiguracionCursoTarea(verb, text, params) {
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

export function handleConfiguracionAsignacion(verb, text, params) {
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

export function handleVariablesAsignacion(verb, text, params) {
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
