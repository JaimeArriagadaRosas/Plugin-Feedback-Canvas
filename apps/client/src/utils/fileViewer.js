/**
 * Verifies if a file extension is natively supported by the Canvas viewer (Canvadocs).
 * Used to determine if the preview iframe should be attempted to load.
 * 
 * @param {string} filename - File name or extension.
 * @returns {boolean} - True if the file is supported, false otherwise.
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
