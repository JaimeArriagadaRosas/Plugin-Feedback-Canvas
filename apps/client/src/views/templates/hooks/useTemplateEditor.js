import { useState, useEffect, useRef, useCallback } from 'react';

export function useTemplateEditor(template) {
  const [name, setName] = useState(template?.name || template?.nombre || "New Feedback Template");
  
  let initialContent = {
    alto: "Dear {{nombre_estudiante}},\n\nExcellent work! Your grade has been {{calificacion}}.\n\nKeep it up.",
    medio: "Dear {{nombre_estudiante}},\n\nYour grade on the activity has been {{calificacion}}.\n\nThe current course average is {{promedio_curso}}.\n\nWe suggest reviewing the following topics...",
    bajo: "Dear {{nombre_estudiante}},\n\nYour grade has been {{calificacion}}.\n\nYou need to improve. We suggest tutoring."
  };

  if (template?.contenido || template?.content) {
    const rawContent = template.contenido || template.content;
    try {
      const parsed = JSON.parse(rawContent);
      if (parsed.alto !== undefined && parsed.medio !== undefined && parsed.bajo !== undefined) {
        initialContent = parsed;
      } else {
        initialContent.medio = rawContent;
      }
    } catch (e) {
      initialContent.medio = rawContent;
    }
  }

  const [content, setContentObj] = useState(initialContent);
  const [currentTab, setCurrentTab] = useState('medio'); // alto, medio, bajo

  const [preview, setPreview] = useState("");
  const editorRef = useRef(null);

  useEffect(() => {
    const currentText = content[currentTab] || "";
    let text = currentText
      .replace(/{{nombre_estudiante}}/g, "Juan Pérez")
      .replace(/{{calificacion}}/g, "3.5")
      .replace(/{{promedio_curso}}/g, "5.2");
    setPreview(text);
  }, [content, currentTab]);

  const setContentString = useCallback((newText) => {
    setContentObj(prev => ({ ...prev, [currentTab]: newText }));
  }, [currentTab]);

  const insertVariable = useCallback((variable) => {
    const editor = editorRef.current;
    if (!editor) return;

    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const text = editor.value;
    const before = text.substring(0, start);
    const after = text.substring(end);

    const newContent = before + `{{${variable}}}` + after;
    setContentString(newContent);

    setTimeout(() => {
      editor.focus();
      editor.setSelectionRange(start + variable.length + 4, start + variable.length + 4);
    }, 0);
  }, [setContentString]);

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
    setContentString(before + replacement + after);

    setTimeout(() => {
      editor.focus();
      editor.setSelectionRange(start + replacement.length, start + replacement.length);
    }, 0);
  }, [setContentString]);

  return {
    name,
    setName,
    content,
    setContent: setContentString,
    currentTab,
    setCurrentTab,
    preview,
    editorRef,
    insertVariable,
    applyFormat,
  };
}
