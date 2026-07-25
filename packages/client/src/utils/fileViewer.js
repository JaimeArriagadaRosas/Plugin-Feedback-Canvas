/**
 * Verifica si una extensión de archivo es soportada nativamente por el visor de Canvas (Canvadocs).
 * Se utiliza para determinar si se debe intentar cargar el iframe de previsualización.
 * 
 * @param {string} filename - Nombre del archivo o extensión.
 * @returns {boolean} - True si el archivo es soportado, false en caso contrario.
 */
export const isSupportedForPreview = (filename) => {
  if (!filename) return false;
  
  const ext = filename.split('.').pop().toLowerCase();
  
  const supportedExtensions = [
    'pdf', 
    'doc', 
    'docx', 
    'xls', 
    'xlsx', 
    'ppt', 
    'pptx',
    'txt',
    'jpg',
    'jpeg',
    'png'
  ];
  
  return supportedExtensions.includes(ext);
};
