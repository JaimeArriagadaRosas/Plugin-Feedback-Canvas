import { omitMissingVariableParagraphs } from './variables/OptionalTemplateVariable.js';

/** Builds prompts from teacher-authored templates and optional Canvas variables. */
export default class PromptManager {
  static async buildPrompt(template, context, resolvers = []) {
    let prompt = template;
    for (const resolver of resolvers) {
      if (!resolver.matches(prompt)) continue;
      const value = await resolver.resolve(context);
      if (value === null || value === undefined || String(value).trim() === '') {
        prompt = omitMissingVariableParagraphs(prompt, resolver.variableName);
      } else {
        prompt = prompt.split(resolver.variableName).join(value);
      }
    }
    return prompt;
  }

  static _formatRubric(rubric) {
    if (!rubric || !Array.isArray(rubric)) return 'No rubric provided.';
    return rubric.map(crit => '- Criterion: ' + crit.description +
      '\n  Points: ' + crit.points + '\n  Previous comment: ' + (crit.comments || 'None')).join('\n');
  }
}
