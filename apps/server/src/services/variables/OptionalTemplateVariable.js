// Omit a complete line if its optional academic datum cannot be obtained.
// This avoids fabricated values and sentences such as "Your grade is ." .
export function omitMissingVariableParagraphs(text, variable) {
  return text.split('\n').filter(line => !line.includes(variable))
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
