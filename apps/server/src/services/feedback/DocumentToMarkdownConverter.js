import JSZip from 'jszip';
import sanitizeHtml from 'sanitize-html';
import { DomainError } from '../../utils/errors.js';

const xmlDecode = (s) => String(s).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
// Scan XML elements without nested quantifiers on untrusted input.
const extractElements = (xml, tagNames) => {
  const elements = [];
  let cursor = 0;
  while (cursor < xml.length) {
    let start = -1;
    let name = '';
    for (const tag of tagNames) {
      const position = xml.indexOf('<' + tag, cursor);
      if (position !== -1 && (start === -1 || position < start)) {
        start = position;
        name = tag;
      }
    }
    if (start === -1) break;
    const boundary = xml.charAt(start + name.length + 1);
    if (![' ', '\t', '\r', '\n', '>', '/'].includes(boundary)) {
      cursor = start + name.length + 1;
      continue;
    }
    const openingEnd = xml.indexOf('>', start + name.length + 1);
    if (openingEnd === -1) break;
    if (xml.charAt(openingEnd - 1) === '/') {
      cursor = openingEnd + 1;
      continue;
    }
    const closingTag = '</' + name + '>';
    const closingStart = xml.indexOf(closingTag, openingEnd + 1);
    if (closingStart === -1) break;
    elements.push({
      full: xml.slice(start, closingStart + closingTag.length),
      content: xml.slice(openingEnd + 1, closingStart)
    });
    cursor = closingStart + closingTag.length;
  }
  return elements;
};
const getText = (xml) => extractElements(xml, ['w:t', 'a:t']).map(({ content }) => xmlDecode(content)).join('');

export default class DocumentToMarkdownConverter {
  async convert(buffer, mime = '', filename = '') {
    if (!Buffer.isBuffer(buffer) || !buffer.length) throw new DomainError('Empty document', 422, 'EMPTY_DOCUMENT');
    const ext = filename.toLowerCase().split('.').pop();
    const type = String(mime).toLowerCase();
    let markdown = '', visualRequired = false;

    if (ext === 'pdf' || type.includes('pdf')) {
      const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
      let pdf;
      try {
        pdf = await getDocument({ data: new Uint8Array(buffer), useSystemFonts: true, disableFontFace: true }).promise;
        if (pdf.numPages > 80) throw new DomainError('PDF too long', 413, 'DOCUMENT_TOO_LARGE');
        const chunks = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const text = await page.getTextContent();
          chunks.push('## Page ' + i + '\n\n' + text.items.map(x => x.str || '').filter(Boolean).join(' '));
          page.cleanup();
        }
        markdown = chunks.join('\n\n');
        visualRequired = markdown.replace(/## Page \d+/g, '').trim().length < 40;
      } finally { if (pdf) await pdf.destroy(); }
    } else if (ext === 'docx' || type.includes('wordprocessingml')) {
      const zip = await JSZip.loadAsync(buffer);
      const xml = await zip.file('word/document.xml')?.async('string');
      if (!xml) throw new DomainError('Invalid DOCX', 422, 'INVALID_DOCUMENT');
      markdown = extractElements(xml, ['w:p']).map(({ full: p }) => {
        const text = getText(p).trim();
        const heading = p.match(/<w:pStyle\s+w:val="Heading([1-6])"/)?.[1];
        return heading ? '#'.repeat(Number(heading)) + ' ' + text : text;
      }).filter(Boolean).join('\n\n');
      visualRequired = Object.keys(zip.files).some(n => n.startsWith('word/media/'));
    } else if (ext === 'pptx' || type.includes('presentationml')) {
      const zip = await JSZip.loadAsync(buffer);
      const slides = Object.keys(zip.files).filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .sort((a,b) => Number(a.match(/slide(\d+)/)[1])-Number(b.match(/slide(\d+)/)[1]));
      if (!slides.length) throw new DomainError('Invalid PPTX', 422, 'INVALID_DOCUMENT');
      if (slides.length > 80) throw new DomainError('Presentation too long', 413, 'DOCUMENT_TOO_LARGE');
      const chunks = [];
      for (const [i, name] of slides.entries()) {
        const xml = await zip.file(name).async('string');
        chunks.push('## Slide ' + (i+1) + '\n\n' + extractElements(xml, ['a:p'])
          .map(({ full: p }) => getText(p).trim()).filter(Boolean).join('\n\n'));
      }
      markdown = chunks.join('\n\n');
      visualRequired = Object.keys(zip.files).some(n => n.startsWith('ppt/media/'));
    } else if (ext === 'txt' || ext === 'md' || type.startsWith('text/plain') || type.startsWith('text/markdown')) {
      markdown = buffer.toString('utf8');
    } else if (ext === 'html' || type === 'text/html') {
      markdown = sanitizeHtml(buffer.toString('utf8'), { allowedTags: [], allowedAttributes: {} });
    } else throw new DomainError('Unsupported document format: ' + filename, 422, 'UNSUPPORTED_DOCUMENT');

    if (markdown.length > 100000) throw new DomainError('Text exceeds the 100000-character limit', 413, 'DOCUMENT_TOO_LARGE');
    return { markdown: markdown.trim(), visualRequired };
  }
}
