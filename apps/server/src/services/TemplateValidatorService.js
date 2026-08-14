export default class TemplateValidatorService {
  /**
   * Validates that a template complies with RF15:
   * Must have content variations for the three key ranges.
   * For simplicity, we assume JSON content must declare 3 blocks.
   */
  validateRanges(template) {
    if (!template || !template.contenido) return false;
    
    // Expected to mention support for the 3 ranges
    const requiredRanges = ['Range 1', 'Range 2', 'Range 3'];
    // Or if based on variable syntax:
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
