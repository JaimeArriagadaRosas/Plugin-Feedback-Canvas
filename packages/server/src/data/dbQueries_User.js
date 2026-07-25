import { localUsers, localPermisosRol, localCanvasTokens, localApiKeys, localWebhookEvents } from './dbConnection.js';
import { now } from '../utils/datetime.js';

export function handleUsuariosLocal(verb, text, params) {
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

export function handlePermisosRol(verb, text, params) {
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

export function handleCanvasUserTokens(verb, text, params) {
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

export function handleLlavesApiIa(verb, text, params) {
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

export function handleWebhookEvents(verb, text, params) {
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

export function handleHistorialAcademicoLocal(verb, text, params) {
  const studentId = params && params[0] ? parseInt(params[0]) : (text.match(/WHERE estudiante_id\s*=\s*(\d+)/i) || [0, 1])[1];
  const historyMap = {
    1: [{ grade: 9.0, date: '2026-05-01' }, { grade: 8.5, date: '2026-05-05' }, { grade: 9.5, date: '2026-05-15' }],
    2: [{ grade: 5.0, date: '2026-05-01' }, { grade: 6.0, date: '2026-05-05' }, { grade: 5.5, date: '2026-05-15' }],
    3: [{ grade: 3.5, date: '2026-05-01' }, { grade: 4.0, date: '2026-05-05' }, { grade: 3.8, date: '2026-05-15' }],
    4: [{ grade: 8.0, date: '2026-05-01' }, { grade: 8.5, date: '2026-05-05' }, { grade: 8.8, date: '2026-05-15' }],
  };
  return { rows: [{ historial_json: historyMap[studentId] || [{ grade: 5.0, date: '2026-05-01' }] }] };
}

export function handleConfiguracionIa(verb, text, params) {
  if (verb === 'SELECT') return { rows: [{ id: 1, modelo_preferido: 'gemini-1.5-flash', prompt_base: 'Eres un asistente de feedback...', temperatura: 0.7, longitud_maxima: 2048, endpoint_api: null }] };
  return { rows: [{ id: 1, modelo_preferido: params[0] || 'gemini-1.5-flash', prompt_base: params[1] || 'Nuevo prompt', temperatura: params[2], longitud_maxima: params[3], endpoint_api: params[4] }] };
}
