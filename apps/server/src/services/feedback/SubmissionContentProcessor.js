import { DomainError } from '../../utils/errors.js';

export default class SubmissionContentProcessor {
  constructor(canvasGateway, converter) { this.canvasGateway = canvasGateway; this.converter = converter; }
  async process(submission, teacherId) {
    if (!submission || submission.workflow_state === 'unsubmitted' || submission.missing)
      throw new DomainError('The student has not submitted', 422, 'NO_SUBMISSION');
    const attachments = Array.isArray(submission.attachments) ? submission.attachments : [];
    if (attachments.length > 8) throw new DomainError('Too many attachments', 413);
    const parts = [], warnings = [], evidence = [], errors = [];
    for (const file of attachments) {
      const name = file.display_name || file.filename || 'attachment';
      try {
        const { buffer, mime } = await this.canvasGateway.downloadSubmissionAttachment(file, teacherId);
        if (buffer.length > 12 * 1024 * 1024) throw new DomainError('Attachment too large', 413);
        if (['image/png','image/jpeg','image/webp'].includes(mime)) {
          parts.push({inlineData:{mimeType:mime,data:buffer.toString('base64')}});
          evidence.push('## Image: ' + name + '\n[Image available to Gemini]');
        } else {
          const doc = await this.converter.convert(buffer,mime,name);
          if (doc.markdown) evidence.push('## Attachment: ' + name + '\n\n' + doc.markdown);
          if (doc.visualRequired && mime === 'application/pdf') {
            parts.push({inlineData:{mimeType:mime,data:buffer.toString('base64')}});
          } else if (doc.visualRequired) warnings.push(name + ': some visual elements could not be extracted.');
        }
      } catch (error) {
        errors.push(name + ': ' + error.message);
      }
    }
    // Never evaluate a cover note as if an attached assignment had been read.
    if (errors.length) throw new DomainError('Could not analyze submission: ' + errors.join('; '), 422, 'ATTACHMENT_UNREADABLE');
    if (!attachments.length && submission.body) {
      const text = String(submission.body).replace(/<[^>]*>/g, ' ').trim();
      if (text) evidence.push('## Submitted text\n\n' + text);
    }
    const answers = submission.submission_data || submission.answers;
    if (Array.isArray(answers) && answers.length) evidence.push('## Answers\n\n' + JSON.stringify(answers));
    if (submission.url) warnings.push('External URLs are not analyzed.');
    const markdown = evidence.join('\n\n');
    if (!markdown.trim() && !parts.length) throw new DomainError('No evaluable content', 422, 'NO_READABLE_CONTENT');
    if (markdown.length > 120000) throw new DomainError('Submission is too long', 413);
    return {markdown,parts,warnings};
  }
}
