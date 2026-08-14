import { colors, font } from '@/tokens';

/**
 * LoadingScreen — Indicador de carga a pantalla parcial.
 * La keyframe `spin` está definida globalmente en styles/theme.css.
 */
export default function LoadingScreen({ message }) {
  return (
    <div
      style={{
        padding: 40,
        fontFamily: font.family,
        color: colors.text,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          border: `3px solid ${colors.border}`,
          borderTopColor: colors.primary,
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      {message || 'Initializing session...'}
    </div>
  );
}
