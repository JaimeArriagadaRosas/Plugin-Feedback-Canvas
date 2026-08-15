/**
 * Module in charge of processing rich text (basic Markdown)
 * and converting it to mathematical Unicode characters to bypass the limitation
 * of plain text of the Canvas LMS API.
 */
export class RichTextProcessor {
  /**
   * Processes a basic Markdown text and returns its Unicode representation.
   * @param {string} text - Original text with Markdown
   * @returns {string} Formatted text with Unicode characters
   */
  static process(text) {
    if (!text) return text;
    
    let processed = text;
    
    // 1. Bold: **text**
    processed = processed.replace(/\*\*(.*?)\*\*/g, (match, p1) => this.toBold(p1));
    
    // 2. Italic: *text* or _text_ (avoiding ** or __)
    processed = processed.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, (match, p1) => this.toItalic(p1));
    processed = processed.replace(/(?<!_)_(?!_)(.*?)(?<!_)_(?!_)/g, (match, p1) => this.toItalic(p1));
    
    // 3. Unordered lists (- or *) at the beginning of the line
    processed = processed.replace(/^[-*]\s+/gm, '• ');
    
    // 4. Underline: <u>text</u>
    processed = processed.replace(/<u>(.*?)<\/u>/g, (match, p1) => this.toUnderline(p1));

    return processed;
  }

  static toBold(text) {
    return Array.from(text).map(char => {
      const code = char.codePointAt(0);
      if (code >= 65 && code <= 90) return String.fromCodePoint(code + 120211); // A-Z
      if (code >= 97 && code <= 122) return String.fromCodePoint(code + 120205); // a-z
      if (code >= 48 && code <= 57) return String.fromCodePoint(code + 120754); // 0-9
      return char;
    }).join('');
  }

  static toItalic(text) {
    return Array.from(text).map(char => {
      const code = char.codePointAt(0);
      if (code >= 65 && code <= 90) return String.fromCodePoint(code + 120263); // A-Z
      if (code >= 97 && code <= 122) return String.fromCodePoint(code + 120257); // a-z
      return char;
    }).join('');
  }

  static toUnderline(text) {
    return Array.from(text).map(char => char + '\u0332').join('');
  }
}
