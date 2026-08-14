/**
 * AI Prompt Engine (Improved Version)
 * Builds complex prompts combining context, ranges, and profiles.
 */
export default class PromptManager {
  /**
   * Generates advanced prompt delegating variable injection to Resolvers
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
   * Formats rubric criteria to be readable by AI
   */
  static _formatRubric(rubric) {
    if (!rubric || !Array.isArray(rubric)) return 'No rubric provided.';

    return rubric.map(crit => {
      return `- Criterion: ${crit.description}\n  Points: ${crit.points}\n  Previous comment: ${crit.comments || 'None'}`;
    }).join('\n');
  }
}
