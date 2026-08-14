import React from 'react';
import styles from './GradeBadges.module.css';

export function GradeBadge({ grade, label }) {
  // RF03: Performance colors (simplified for student)
  // Green: Achieved (>= 60)
  // Yellow: Pending (>= 40 < 60)
  // Red: Support (< 40)
  // Blue: Motivational (Not applicable to pure grades but can be passed as a variant)

  let variant = 'default';
  
  if (typeof grade === 'number') {
    if (grade >= 60) variant = 'success';
    else if (grade >= 40) variant = 'warning';
    else variant = 'danger';
  }

  // If a specific label is passed ("Achieved", "Support"), it overrides the grade calculation
  if (label) {
    const l = label.toLowerCase();
    if (l.includes('achieved') || l.includes('logrado')) variant = 'success';
    else if (l.includes('pending') || l.includes('pendiente')) variant = 'warning';
    else if (l.includes('support') || l.includes('apoyo')) variant = 'danger';
    else if (l.includes('motivational') || l.includes('motivacional')) variant = 'info';
  }

  const text = label || (grade !== undefined ? `${grade.toFixed(1)}` : 'N/A');

  return (
    <span className={`${styles.badge} ${styles[variant]}`}>
      {text}
    </span>
  );
}
