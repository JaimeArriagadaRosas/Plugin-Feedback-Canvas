// Never erase unrelated teacher-written text merely because a variable is missing.
export function omitMissingVariableParagraphs(text, variable) {
  const labelOnly = /^(?:course average|average|promedio(?: del curso)?|grade|nota|calificaci[oó]n)\s*:\s*$/i;
  return text.split('\n').map(line => {
    if (!line.includes(variable)) return line;
    const rest = line.split(variable).join('').replace(/[ \t]{2,}/g, ' ').trim();
    if (!rest || labelOnly.test(rest)) return null;

    // Remove an incomplete academic sentence without
    // deleting independent teacher-written comments.
    const orphanAcademicPhrase =
      /^(?:your (?:grade|score) is|the course average is|(?:tu|su) (?:nota|calificaci[oó]n) es|el promedio (?:del curso )?es)\s*(?:[.!?]\s*|$)/i;

    const cleaned = rest.replace(orphanAcademicPhrase, '').trim();
    return cleaned || null;
  }).filter(line => line !== null)
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
