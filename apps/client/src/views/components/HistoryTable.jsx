import React from 'react';
import styles from './HistoryTable.module.css';

export default function HistoryTable({ tareas }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr className={styles.tableHead}>
          <th className={styles.thLeft}>
            Assignment
          </th>
          <th className={styles.thCenter}>
            Grade
          </th>
          <th className={styles.thRight}>
            Date
          </th>
        </tr>
      </thead>
      <tbody>
        {tareas.map((tarea, idx) => (
          <tr 
            key={idx} 
            className={`${styles.trBody} ${idx % 2 === 0 ? styles.trBodyEven : styles.trBodyOdd}`}
          >
            <td className={styles.tdLeft}>
              {tarea.nombre}
            </td>
            <td className={`${styles.tdCenter} ${tarea.nota >= 6 ? styles.scoreHigh : tarea.nota >= 4 ? styles.scoreMedium : styles.scoreLow}`}>
              {tarea.nota.toFixed(1)}
            </td>
            <td className={styles.tdRight}>
              {tarea.fecha}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
