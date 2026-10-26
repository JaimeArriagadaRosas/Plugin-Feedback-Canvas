/** Convierte saltos de línea falsos de plantillas heredadas en Enter real.
 * No ejecuta evaluaciones ni modifica material fuera de los tres rangos. */
export function normalizeSeedTemplateContent(raw) {
  if (typeof raw !== 'string') return raw;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Algunos datos heredados contienen una capa adicional de escapes.
    try { parsed = JSON.parse(raw.replace(/\\\\n/g, '\\n')); }
    catch { throw new Error('Template JSON is invalid; refusing to rewrite it'); }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return raw;
  const normalize = (value) =>
    typeof value === 'string'
      ? value.replace(/\\r\\n|\\n|\\r/g, '\n')
      : value;

  const alto = normalize(parsed.alto);
  const medio = normalize(parsed.medio);
  const bajo = normalize(parsed.bajo);

  if (alto === parsed.alto &&
      medio === parsed.medio &&
      bajo === parsed.bajo) {
    return raw;
  }

  return JSON.stringify({ ...parsed, alto, medio, bajo });
}
