import { useState, useEffect, useRef } from 'react';
import logger from '../../../utils/logger';

export function useTemplateEditor(template) {
  const [name, setName] = useState(template?.name || "Nueva Plantilla de Feedback");
  const [range, setRange] = useState("Rango Bajo: 0-3.9");
  const [content, setContent] = useState(
    template?.content || "Estimado {{nombre_estudiante}},\n\nTu calificación en la actividad ha sido {{calificacion}}.\n\nEl promedio actual del curso es {{promedio_curso}}.\n\nTe sugerimos revisar los siguientes temas..."
  );
  const [preview, setPreview] = useState("");
  const editorRef = useRef(null);

  useEffect(() => {
    let text = content
      .replace(/{{nombre_estudiante}}/g, "Juan Pérez")
      .replace(/{{calificacion}}/g, "3.5")
      .replace(/{{promedio_curso}}/g, "5.2");
    setPreview(text);
  }, [content]);

  const insertVariable = useCallback((variable) => {
    const editor = editorRef.current;
    if (!editor) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const text = editor.value;
    const before = text.substring(0, start);
    const after = text.substring(end);

    const newContent = before + `{{${variable}}}` + after;
    setContent(newContent);

    setTimeout(() => {
      editor.focus();
      editor.setSelectionRange(start + variable.length + 4, start + variable.length + 4);
    }, 0);
  }, []);

  const applyFormat = useCallback((format) => {
    const editor = editorRef.current;
    if (!editor) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selection = editor.value.substring(start, end);
    let replacement = "";

    switch (format) {
      case "bold": replacement = `**${selection}**`; break;
      case "italic": replacement = `*${selection}*`; break;
      case "underline": replacement = `<u>${selection}</u>`; break;
      case "list": replacement = `\n- ${selection}`; break;
      case "numlist": replacement = `\n1. ${selection}`; break;
      default: replacement = selection;
    }

    const before = editor.value.substring(0, start);
    const after = editor.value.substring(end);
    setContent(before + replacement + after);

    setTimeout(() => {
      editor.focus();
      editor.setSelectionRange(start + replacement.length, start + replacement.length);
    }, 0);
  }, []);

  return {
    name,
    setName,
    range,
    setRange,
    content,
    setContent,
    preview,
    editorRef,
    insertVariable,
    applyFormat,
  };
}
