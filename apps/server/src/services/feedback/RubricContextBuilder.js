import sanitizeHtml from 'sanitize-html';

const clear = (value) => sanitizeHtml(String(value ?? ''), { allowedTags: [], allowedAttributes: {} }).trim().slice(0, 14000);
export default class RubricContextBuilder {
  build(assignment, rubric) {
    const instructions = clear(assignment?.description);
    const criteria = Array.isArray(rubric) ? rubric : (Array.isArray(rubric?.data) ? rubric.data : []);
    const rubricText = criteria.slice(0, 35).map((c, index) => {
      const levels = (c.ratings || []).map(r => clear(r.description || r.long_description)).filter(Boolean);
      return [String(index + 1) + '. ' + clear(c.description || c.long_description || 'Criterio'), levels.length ? 'Referencias: ' + levels.join('; ') : ''].filter(Boolean).join('\n');
    }).join('\n');
    return { instructions, rubric: rubricText, basis: rubricText ? 'rubric' : (instructions ? 'instructions' : 'general') };
  }
}
