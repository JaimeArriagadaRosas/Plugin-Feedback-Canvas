import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/api';
import Toast from './Toast';

export default function GlobalSystemErrorNotifier() {
  const [globalToast, setGlobalToast] = useState(null);
  const previousErrorsRef = useRef(0);

  const { data: systemErrors = [] } = useQuery({
    queryKey: ['system-notifications-pending'],
    queryFn: async () => {
      const response = await api.get(`/system-notifications/pending`);
      if (response.exito) {
        return response.data;
      }
      return [];
    },
    refetchInterval: 15000,
  });

  const totalErrors = systemErrors.reduce((acc, curr) => acc + parseInt(curr.cantidad || 0, 10), 0);

  useEffect(() => {
    // Si incrementa la cantidad de errores, mostrar toast global
    if (totalErrors > previousErrorsRef.current) {
      setGlobalToast({
        message: '¡Atención! Ha ocurrido un nuevo error de sistema. Revisa tus notificaciones de sistema.',
        type: 'error'
      });
    }
    previousErrorsRef.current = totalErrors;
  }, [totalErrors]);

  if (!globalToast) return null;

  return (
    <div style={{ zIndex: 99999 }}>
      <Toast
        message={globalToast.message}
        type={globalToast.type}
        onClose={() => setGlobalToast(null)}
        duration={10000}
      />
    </div>
  );
}
