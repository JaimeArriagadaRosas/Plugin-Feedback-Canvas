/**
 * Design Tokens — Fuente única de verdad para el sistema visual.
 *
 * Centraliza colores, tipografía, espaciados, radios y sombras que antes
 * estaban hardcodeados y duplicados en decenas de componentes.
 *
 * Uso en JS/JSX:
 *   import { colors, font } from '../../styles/tokens';
 *   <div style={{ color: colors.text, fontFamily: font.family }} />
 *
 * Los mismos valores están expuestos como variables CSS en theme.css
 * (p. ej. var(--color-primary)) para su uso desde CSS Modules.
 */

export const colors = {
  // Marca / acentos (paleta Canvas LMS)
  primary: '#0770a3',      // azul Canvas (enlaces, acciones)
  text: '#2d3b45',         // slate oscuro (texto principal)
  border: '#c7cdd1',       // gris de bordes
  borderLight: '#e0e4e8',  // gris de bordes suaves

  // Fondos
  bg: '#f5f5f5',
  surface: '#ffffff',
  surfaceAlt: '#f9f9f9',
  surfaceHeader: '#f0f4f7',
  surfaceMuted: '#eee',
  docBg: '#e0e4e7',

  // Texto secundario
  textMuted: '#666',
  textFaint: '#888',
  textDisabled: '#aaa',

  // Estados semánticos
  success: '#27ae60',
  successBg: '#e9f7ef',
  successText: '#1d8348',
  danger: '#c0392b',
  dangerAlt: '#e74c3c',
  dangerBg: '#fdedec',
  dangerText: '#922b21',
  warning: '#b58900',
  warningBg: '#fef9e7',
  warningBorder: '#f9e79f',
  info: '#31708f',
  infoBg: '#d9edf7',
  infoBorder: '#bce8f1',
  star: '#f1c40f',

  // Superpuestos
  overlay: 'rgba(0,0,0,0.5)',
};

export const font = {
  family: "'Lato', 'Helvetica Neue', Arial, sans-serif",
  familyMono: "monospace",
  size: {
    xs: 11,
    sm: 12,
    base: 14,
    md: 15,
    lg: 16,
    xl: 18,
    xxl: 22,
    title: 24,
  },
  weight: {
    normal: 400,
    semibold: 600,
    bold: 700,
  },
};

export const space = {
  xs: 5,
  sm: 8,
  md: 15,
  lg: 20,
  xl: 30,
  xxl: 40,
};

export const radius = {
  sm: 4,
  md: 8,
  pill: 12,
  round: '50%',
};

export const shadow = {
  sm: '0 2px 4px rgba(0,0,0,0.05)',
  md: '0 4px 10px rgba(0,0,0,0.1)',
  lg: '0 4px 15px rgba(0,0,0,0.2)',
  panel: '-2px 0 10px rgba(0,0,0,0.05)',
};

export const zIndex = {
  modal: 1000,
  toast: 1100,
};

export default { colors, font, space, radius, shadow, zIndex };
