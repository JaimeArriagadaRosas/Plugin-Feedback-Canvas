import { DomainError } from '../../utils/errors.js';
export default class SubmissionContentProcessor {
  constructor(canvasGateway, converter) { this.canvasGateway = canvasGateway; this.converter = converter; }
  async process(submission, teacherId) {
    if (!submission || submission.workflow_state === 'unsubmitted' || submission.missing) throw new DomainError('Entrega inexistente', 422, 'NO_SUBMISSION');
    const snippets = [];
    if (submission.body) snippets.push('## Texto\n\n' + String(submission.body).replace(/<[^>]*>/g, ' '));
    const warnings = [];
    const parts = [];
    const attachments = submission.attachments || [];
    if (attachments.length > 8) throw new DomainError('Demasiados adjuntos', 413);
    for (const file of attachments) {
      try {
        const { buffer, mime } = await this.canvasGateway.downloadSubmissionAttachment(file, teacherId);
        if (buffer.length > 12 * 1024 * 1024) throw new Error('Archivo demasiado grande');
        const name = file.filename || 'archivo';
        if (['image/png','image/jpeg','image/webp'].includes(mime)) {
          parts.push({ inlineData: { mimeType: mime, data: buffer.toString('base64') } });
          snippets.push('## Imagen: ' + name);
        } else {
          const doc = await this.converter.convert(buffer, mime, name);
          if (doc.markdown) snippets.push('## Archivo: ' + name + '\n\n' + doc.markdown);
          if (doc.visualRequired && mime === 'application/pdf') parts.push({ inlineData: { mimeType: mime, data: buffer.toString('base64') } });
          else if (doc.visualRequired) warnings.push(name + ': revisar elementos visuales manualmente');
        }
      } catch (error) { warnings.push((file.filename || 'archivo') + ': ' + error.message); }
    }
    if (submission.url) warnings.push('No se analiza URL externa');
    const answers = submission.submission_data || submission.answers;
    if (Array.isArray(answers) && answers.length) snippets.push('## Respuestas\n\n' + JSON.stringify(answers));
    const markdown = snippets.join('\n\n');
    if (!markdown && !parts.length) throw new DomainError('Sin contenido evaluable', 422, 'NO_READABLE_CONTENT');
    if (markdown.length > 120000) throw new DomainError('Entrega demasiado extensa', 413);
    return { markdown, parts, warnings };
  }
}
