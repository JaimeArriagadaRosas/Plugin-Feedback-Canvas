import { describe, it, expect, vi } from 'vitest';
import JSZip from 'jszip';
import DocumentToMarkdownConverter from '../../src/services/feedback/DocumentToMarkdownConverter.js';
import SubmissionContentProcessor from '../../src/services/feedback/SubmissionContentProcessor.js';
import RubricContextBuilder from '../../src/services/feedback/RubricContextBuilder.js';
import FeedbackResponseNormalizer from '../../src/services/feedback/FeedbackResponseNormalizer.js';
import GradeConverter from '../../src/services/calificaciones/GradeConverter.js';

describe('Nuevo motor cualitativo: ingesta local', () => {
  it('distingue una nota cero de una nota ausente', () => {
    expect(GradeConverter.processGrade(undefined, { score: 0, points_possible: 100 }).canvasScore).toBe(0);
    expect(() => GradeConverter.processGrade(undefined, { score: null })).toThrow();
  });
  it('normaliza TXT', async () => {
    const converted = await new DocumentToMarkdownConverter().convert(Buffer.from('Resumen del proyecto'), 'text/plain', 'resumen.txt');
    expect(converted.markdown).toContain('Resumen');
  });
  it('normaliza DOCX sin subirlo a IA', async () => {
    const zip = new JSZip();
    zip.file('word/document.xml', '<w:document><w:p><w:r><w:t>Objetivo del informe</w:t></w:r></w:p></w:document>');
    const data = await zip.generateAsync({ type: 'nodebuffer' });
    const result = await new DocumentToMarkdownConverter().convert(data, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'tarea.docx');
    expect(result.markdown).toContain('Objetivo del informe');
  });
  it('normaliza PPTX manteniendo diapositiva', async () => {
    const zip = new JSZip();
    zip.file('ppt/slides/slide1.xml', '<p:sld><a:p><a:r><a:t>Hipótesis</a:t></a:r></a:p></p:sld>');
    const data = await zip.generateAsync({ type: 'nodebuffer' });
    const result = await new DocumentToMarkdownConverter().convert(data, '', 'presentacion.pptx');
    expect(result.markdown).toContain('Diapositiva 1');
    expect(result.markdown).toContain('Hipótesis');
  });
  it('distingue con y sin rúbrica', () => {
    const builder = new RubricContextBuilder();
    expect(builder.build({ description: 'Investigar' }, [{ description: 'Calidad de evidencia' }]).basis).toBe('rubric');
    expect(builder.build({ description: 'Investigar' }, []).basis).toBe('instructions');
    expect(builder.build({}, []).basis).toBe('general');
  });
  it('procesa texto sin descargar archivos', async () => {
    const downloader = vi.fn();
    const content = await new SubmissionContentProcessor({ downloadSubmissionAttachment: downloader }, new DocumentToMarkdownConverter()).process({ workflow_state: 'submitted', body: '<p>Mi análisis</p>' }, 'teacher');
    expect(content.markdown).toContain('Mi análisis');
    expect(downloader).not.toHaveBeenCalled();
  });
  it('rechaza entrega sin contenido', async () => {
    const processor = new SubmissionContentProcessor({}, new DocumentToMarkdownConverter());
    await expect(processor.process({workflow_state:'submitted'}, 'teacher')).rejects.toThrow();
  });
  it('rechaza texto ficticio de respaldo', () => {
    expect(() => new FeedbackResponseNormalizer().normalize('[MODO LOCAL – Sin API Key] El trabajo tiene aspectos relevantes')).toThrow();
  });
});
