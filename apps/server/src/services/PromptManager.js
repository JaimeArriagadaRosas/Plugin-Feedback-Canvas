/**
 * Motor de Prompts IA (Versión Mejorada)
 * Construye prompts complejos combinando contexto, rangos y perfiles.
 */
export default class PromptManager {
  /**
   * Genera un prompt avanzado delegando la inyección de variables a los Resolvers
   */
  static async buildPrompt(template, context, resolvers = []) {
    let prompt = template;

    for (const resolver of resolvers) {
      if (resolver.matches(prompt)) {
        const value = await resolver.resolve(context);
        prompt = prompt.split(resolver.variableName).join(value);
      }
    }

    return prompt;
  }

  /**
   * Formatea los criterios de la rúbrica para ser legibles por la IA
   */
  static _formatRubric(rubric) {
    if (!rubric || !Array.isArray(rubric)) return 'No se proporcionó rúbrica.';

    return rubric.map(crit => {
      return `- Criterio: ${crit.description}\n  Puntos: ${crit.points}\n  Comentario previo: ${crit.comments || 'Ninguno'}`;
    }).join('\n');
  }
}
