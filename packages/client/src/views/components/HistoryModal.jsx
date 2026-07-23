import React from 'react';

const historialMock = {
  estudiante: 'Juan Pérez',
  tareas: [
    { nombre: 'Tarea 1: Lenguaje de modelado universal', nota: 4.8, fecha: '2025-01-15' },
    { nombre: 'Tarea 2: Diagramas de secuencia', nota: 5.2, fecha: '2025-02-01' },
    { nombre: 'Tarea 3: Arquitectura de software', nota: 6.0, fecha: '2025-02-20' }
  ],
  promedio: 5.33,
  tendencia: 'Mejorando'
};

export default function HistoryModal({ onClose, estudiante }) {
  const data = historialMock;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      fontFamily: 'var(--font-family)',
      padding: '20px'
    }}>
      <div style={{
        background: '#fff',
        borderRadius: '8px',
        width: '100%',
        maxWidth: '600px',
        maxHeight: '80vh',
        boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f5f5f5'
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: 700,
            color: 'var(--color-text)',
            textTransform: 'uppercase',
            letterSpacing: '0.3px'
          }}>
            📊 Historial de Calificaciones
          </h2>
          <button
            onClick={onClose}
            title="Cerrar"
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '22px',
              cursor: 'pointer',
              color: '#666',
              lineHeight: 1,
              padding: '0 4px'
            }}
          >
            ×
          </button>
        </div>

        <div style={{
          padding: '20px',
          overflowY: 'auto',
          flex: 1,
          backgroundColor: '#fff'
        }}>
          <div style={{
            marginBottom: '18px',
            padding: '10px 14px',
            backgroundColor: '#f0f4f7',
            borderRadius: '6px',
            border: '1px solid var(--color-border)'
          }}>
            <strong style={{ color: 'var(--color-text)', fontSize: '14px' }}>
              Estudiante: {data.estudiante}
            </strong>
          </div>

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
              {data.tareas.map((tarea, idx) => (
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

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 14px',
            backgroundColor: '#f7f9fb',
            borderRadius: '6px',
            border: '1px solid var(--color-border)',
            marginBottom: '12px'
          }}>
            <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '14px' }}>
              Promedio general
            </span>
            <span style={{
              fontWeight: 700,
              fontSize: '18px',
              color: data.promedio >= 6 ? '#155724' : data.promedio >= 4 ? '#856404' : '#721c24'
            }}>
              {data.promedio.toFixed(2)}
            </span>
          </div>

          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 14px',
            backgroundColor: '#eef5fb',
            borderRadius: '6px',
            border: '1px solid #c3d9f0',
            marginBottom: '12px'
          }}>
            <span style={{ fontWeight: 700, color: 'var(--color-text)', fontSize: '14px' }}>
              Tendencia
            </span>
            <span style={{
              fontWeight: 700,
              fontSize: '14px',
              color: '#0770a3'
            }}>
              {data.tendencia}
            </span>
          </div>

          <div style={{
            textAlign: 'right',
            fontSize: '11px',
            color: 'var(--color-text-muted)',
            marginTop: '8px'
          }}>
            Última actualización: {new Date().toLocaleDateString('es-ES')}
          </div>
        </div>

        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'flex-end',
          backgroundColor: '#f9f9f9'
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              backgroundColor: '#0770a3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 700,
              fontSize: '13px'
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
