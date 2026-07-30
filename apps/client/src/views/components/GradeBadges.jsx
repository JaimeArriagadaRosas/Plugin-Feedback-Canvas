import React from 'react';
import styles from './GradeBadges.module.css';

export function GradeBadge({ grade, label }) {
  // RF03: Colores por desempeño (simplificado para el estudiante)
  // Verde: Logrado (>= 60)
  // Amarillo: Pendiente (>= 40 < 60)
  // Rojo: Apoyo (< 40)
  // Azul: Motivacional (No aplicable a notas puras pero se puede pasar como variante)

  let variant = 'default';
  
  if (typeof grade === 'number') {
    if (grade >= 60) variant = 'success';
    else if (grade >= 40) variant = 'warning';
    else variant = 'danger';
  }

  // Si se pasa un label específico ("Logrado", "Apoyo"), anula el cálculo de la nota
  if (label) {
    const l = label.toLowerCase();
    if (l.includes('logrado')) variant = 'success';
    else if (l.includes('pendiente')) variant = 'warning';
    else if (l.includes('apoyo')) variant = 'danger';
    else if (l.includes('motivacional')) variant = 'info';
  }

  const text = label || (grade !== undefined ? `${grade.toFixed(1)}` : 'N/A');

  return (
    <span className={`${styles.badge} ${styles[variant]}`}>
      {text}
    </span>
  );
}
