import logger from '../utils/logger.js';
import {
  sqlVerb, sqlTable, localFeedbacks, localWebhookEvents, localApiKeys, localTemplates,
  localCourseConfig, localAssignmentConfig, localAssignmentVariables, localUsers, localProfesorMetadata
} from './dbConnection.js';
import {
  handlePlantillaFeedback, handleHistorialFeedbackGenerado, handleConfiguracionCursoTarea,
  handleConfiguracionAsignacion, handleVariablesAsignacion, handleProfesorMetadata
} from './dbQueries_Feedback.js';
import {
  handleUsuariosLocal, handlePermisosRol, handleCanvasUserTokens, handleLlavesApiIa,
  handleWebhookEvents, handleHistorialAcademicoLocal, handleConfiguracionIa
} from './dbQueries_User.js';

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
