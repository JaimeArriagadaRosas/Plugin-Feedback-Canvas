import PDFDocument from 'pdfkit';
import { describe, it, expect } from 'vitest';
import DocumentToMarkdownConverter from '../../src/services/feedback/DocumentToMarkdownConverter.js';

describe('Real PDF extraction', () => {
  it('extracts text on each page', async () => {
    const doc = new PDFDocument({ autoFirstPage: false, compress: false });
    const chunks = [];
    doc.on('data', (data) => chunks.push(data));
    const completed = new Promise((resolve, reject) => {
      doc.on('end', resolve);
      doc.on('error', reject);
    });
    doc.addPage().fontSize(14).text('Hypothesis and verifiable conclusions');
    doc.end();
    await completed;
    const result = await new DocumentToMarkdownConverter().convert(Buffer.concat(chunks), 'application/pdf', 'informe.pdf');
    expect(result.markdown).toContain('Page 1');
    expect(result.markdown).toContain('Hypothesis');
  });
});
