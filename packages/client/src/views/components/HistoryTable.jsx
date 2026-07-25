import React from 'react';

export default function HistoryTable({ tareas }) {
  return (
    <table style={{
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: '13px',
      marginBottom: '20px'
    }}>
      <thead>
        <tr style={{
          backgroundColor: '#f7f9fb',
          borderBottom: '2px solid var(--color-border)'
        }}>
          <th style={{
            textAlign: 'left',
            padding: '10px 12px',
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            fontSize: '11px',
            letterSpacing: '0.3px'
          }}>
            Tarea
          </th>
          <th style={{
            textAlign: 'center',
            padding: '10px 12px',
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            fontSize: '11px',
            letterSpacing: '0.3px',
            width: '100px'
          }}>
            Nota
          </th>
          <th style={{
            textAlign: 'right',
            padding: '10px 12px',
            fontWeight: 700,
            color: 'var(--color-text-muted)',
            textTransform: 'uppercase',
            fontSize: '11px',
            letterSpacing: '0.3px',
            width: '120px'
          }}>
            Fecha
          </th>
        </tr>
      </thead>
      <tbody>
        {tareas.map((tarea, idx) => (
          <tr key={idx} style={{
            borderBottom: '1px solid #f0f4f7',
            backgroundColor: idx % 2 === 0 ? '#fff' : '#fafbfc'
          }}>
            <td style={{ padding: '10px 12px', color: 'var(--color-text)' }}>
              {tarea.nombre}
            </td>
            <td style={{
              textAlign: 'center',
              padding: '10px 12px',
              fontWeight: 700,
              color: tarea.nota >= 6 ? '#155724' : tarea.nota >= 4 ? '#856404' : '#721c24'
            }}>
              {tarea.nota.toFixed(1)}
            </td>
            <td style={{
              textAlign: 'right',
              padding: '10px 12px',
              color: 'var(--color-text-muted)',
              fontSize: '12px'
            }}>
              {tarea.fecha}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
