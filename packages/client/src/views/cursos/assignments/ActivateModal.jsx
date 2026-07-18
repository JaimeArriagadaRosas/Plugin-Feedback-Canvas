import { useState, useCallback, useMemo } from 'react';
import Modal from '../../../components/atoms/Modal';
import Button from '../../../components/atoms/Button';
import { useButtonLogger } from '../../../hooks/useButtonLogger';
import styles from './DeactivateModal.module.css';

const AVAILABLE_VARIABLES = [
  { id: 'tono', label: 'Tono del feedback (Empático, Directo)' },
  { id: 'rubrica', label: 'Basado en Rúbrica' },
  { id: 'historial', label: 'Historial del Estudiante' },
  { id: 'longitud', label: 'Longitud (Breve, Extenso)' },
];

export default function ActivateModal({ assignment, isOpen, onClose, onConfirm }) {
  const logConfirm = useButtonLogger();
  const logCancel = useButtonLogger();
  const [selectedVars, setSelectedVars] = useState({});

  const handleToggleVar = (id) => {
    setSelectedVars(prev => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = 0; // initial weight
      }
      return next;
    });
  };

  const handleWeightChange = (id, value) => {
    const val = parseInt(value, 10) || 0;
    setSelectedVars(prev => ({ ...prev, [id]: val }));
  };

  const totalWeight = useMemo(() => {
    return Object.values(selectedVars).reduce((sum, val) => sum + val, 0);
  }, [selectedVars]);

  const isValid = Object.keys(selectedVars).length === 0 || totalWeight === 100;

  const handleConfirm = useCallback(
    async (e) => {
      if (!isValid) return;
      const variables = Object.entries(selectedVars).map(([id, peso]) => ({ id, peso }));
      await logConfirm('ASSIGNMENT_ACTIVATE_CONFIRM', () => onConfirm?.(variables))(e);
    },
    [onConfirm, logConfirm, isValid, selectedVars]
  );

  const handleCancel = useCallback(
    async (e) => {
      await logCancel('ASSIGNMENT_ACTIVATE_CANCEL', () => onClose?.())(e);
    },
    [onClose, logCancel]
  );

  if (!assignment) return null;

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} title="Configurar Activación del Plugin">
      <div className={styles.body}>
        <p>
          Configure las variables para la generación de feedback en la tarea: <strong>"{assignment.name}"</strong>
        </p>
        
        <div style={{ marginTop: '20px' }}>
          <h4>Variables de Personalización</h4>
          <p style={{ fontSize: '0.9em', color: '#666', marginBottom: '10px' }}>
            Si seleccionas variables, la suma de sus ponderaciones debe ser exactamente 100%.
          </p>
          
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {AVAILABLE_VARIABLES.map(v => (
              <li key={v.id} style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
                <label style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input 
                    type="checkbox" 
                    checked={selectedVars[v.id] !== undefined} 
                    onChange={() => handleToggleVar(v.id)} 
                  />
                  {v.label}
                </label>
                {selectedVars[v.id] !== undefined && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <input 
                      type="number" 
                      min="1" 
                      max="100" 
                      value={selectedVars[v.id]} 
                      onChange={(e) => handleWeightChange(v.id, e.target.value)}
                      style={{ width: '60px', padding: '4px' }}
                    />
                    <span>%</span>
                  </div>
                )}
              </li>
            ))}
          </ul>
          
          {Object.keys(selectedVars).length > 0 && (
            <div style={{ marginTop: '10px', fontWeight: 'bold', color: totalWeight === 100 ? 'green' : 'red' }}>
              Total ponderación: {totalWeight}% {totalWeight !== 100 && '(Debe sumar 100%)'}
            </div>
          )}
        </div>
      </div>
      <div className={styles.footer}>
        <Button variant="secondary" onClick={handleCancel}>
          Cancelar
        </Button>
        <Button variant="primary" onClick={handleConfirm} disabled={!isValid}>
          Activar y Guardar
        </Button>
      </div>
    </Modal>
  );
}