import { now } from '../../utils/datetime.js';

export function createFeedback(overrides = {}) {
  return {
    id: overrides.id ?? Math.floor(Math.random() * 10000),
    estudiante_id: overrides.estudiante_id ?? 1,
    curso_id: overrides.curso_id ?? 14852,
    tarea_id: overrides.tarea_id ?? 101,
    plantilla_id: overrides.plantilla_id ?? 1,
    contenido_generado: overrides.contenido_generado ?? 'Feedback de prueba',
    prompt_usado: overrides.prompt_usado ?? 'Prompt de prueba',
    nota_canvas: overrides.nota_canvas ?? 90,
    nota_chile: overrides.nota_chile ?? 6.9,
    aprobado: overrides.aprobado ?? true,
    estado: overrides.estado ?? 'generado',
    calificacion_profesor: overrides.calificacion_profesor ?? null,
    calificacion_estudiante: overrides.calificacion_estudiante ?? null,
    fecha_generacion: overrides.fecha_generacion ?? now()
  };
}

export function createTemplate(overrides = {}) {
  return {
    id: overrides.id ?? Math.floor(Math.random() * 10000),
    nombre: overrides.nombre ?? 'Plantilla de prueba',
    contenido: overrides.contenido ?? 'Estimado/a {{STUDENT_NAME}}, tu nota es {{CHILE_GRADE}} de 7.0.',
    creado_en: overrides.creado_en ?? now(),
    actualizado_en: overrides.actualizado_en ?? now()
  };
}

export function createConfig(overrides = {}) {
  return {
    id: overrides.id ?? 1,
    modelo_preferido: overrides.modelo_preferido ?? 'gemini-1.5-flash',
    prompt_base: overrides.prompt_base ?? 'Eres un asistente de feedback...',
    actualizado_en: overrides.actualizado_en ?? now()
  };
}
