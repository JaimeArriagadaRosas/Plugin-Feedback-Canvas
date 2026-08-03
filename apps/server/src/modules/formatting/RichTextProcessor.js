/**
 * Módulo encargado de procesar texto enriquecido (Markdown básico)
 * y convertirlo a caracteres Unicode matemáticos para saltarse la limitación
 * de texto plano de la API de Canvas LMS.
 */
export class RichTextProcessor {
  /**
   * Procesa un texto en Markdown básico y devuelve su representación en Unicode.
   * @param {string} text - Texto original con Markdown
   * @returns {string} Texto formateado con caracteres Unicode
   */
  static process(text) {
    if (!text) return text;
    
    let processed = text;
    
    // 1. Negrita: **texto**
    processed = processed.replace(/\*\*(.*?)\*\*/g, (match, p1) => this.toBold(p1));
    
    // 2. Cursiva: *texto* o _texto_ (evitando ** o __)
    processed = processed.replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, (match, p1) => this.toItalic(p1));
    processed = processed.replace(/(?<!_)_(?!_)(.*?)(?<!_)_(?!_)/g, (match, p1) => this.toItalic(p1));
    
    // 3. Listas no ordenadas (- o *) a inicio de línea
    processed = processed.replace(/^[-*]\s+/gm, '• ');
    
    // 4. Subrayado: <u>texto</u>
    processed = processed.replace(/<u>(.*?)<\/u>/g, (match, p1) => this.toUnderline(p1));
    
    // 4. Listas ordenadas (1. ) a inicio de línea
    // (Opcionalmente, se pueden dejar igual ya que 1. ya es texto legible)
    // processed = processed.replace(/^\d+\.\s+/gm, (match) => match); 

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
