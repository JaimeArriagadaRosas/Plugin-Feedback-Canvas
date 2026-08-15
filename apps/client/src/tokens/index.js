/**
 * Design Tokens — Single source of truth for the visual system.
 *
 * Centralizes colors, typography, spacing, radii and shadows that were previously
 * hardcoded and duplicated in dozens of components.
 *
 * Usage in JS/JSX:
 *   import { colors, font } from '../../styles/tokens';
 *   <div style={{ color: colors.text, fontFamily: font.family }} />
 *
 * The same values are exposed as CSS variables in theme.css
 * (e.g. var(--color-primary)) for use from CSS Modules.
 */

export const colors = {
  // Brand / accents (Canvas LMS palette)
  primary: '#0770a3',      // Canvas blue (links, actions)
  text: '#2d3b45',         // dark slate (main text)
  border: '#c7cdd1',       // border gray
  borderLight: '#e0e4e8',  // soft border gray

  // Backgrounds
  bg: '#f5f5f5',
  surface: '#ffffff',
  surfaceAlt: '#f9f9f9',
  surfaceHeader: '#f0f4f7',
  surfaceMuted: '#eee',
  docBg: '#e0e4e7',

  // Secondary text
  textMuted: '#666',
  textFaint: '#888',
  textDisabled: '#aaa',

  // Semantic states
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

  // Overlays
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
