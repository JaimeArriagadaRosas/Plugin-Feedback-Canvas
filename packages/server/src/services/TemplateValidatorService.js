export default class TemplateValidatorService {
  /**
   * Valida que una plantilla cumpla con el RF15:
   * Debe tener variaciones de contenido para los tres rangos clave.
   * Por simplicidad de evaluación, asumimos que el contenido JSON debe declarar 3 bloques.
   */
  validateRanges(template) {
    if (!template || !template.contenido) return false;
    
    // Se espera que la plantilla mencione soporte para los 3 rangos
    const requiredRanges = ['Rango 1', 'Rango 2', 'Rango 3'];
    // O si se basa en sintaxis de variables:
    const requiresCheck = ['>= 6.0', '4.0-5.9', '< 4.0'];

    const contentStr = typeof template.contenido === 'string' 
      ? template.contenido 
      : JSON.stringify(template.contenido);

    // Simple keyword validation logic for RF15
    const hasRanges = requiredRanges.every(r => contentStr.includes(r)) 
                   || requiresCheck.every(r => contentStr.includes(r));

    return hasRanges;
  }
}
