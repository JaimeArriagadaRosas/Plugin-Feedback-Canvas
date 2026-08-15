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
    // If error count increases, show global toast
    if (totalErrors > previousErrorsRef.current) {
      setGlobalToast({
        message: 'Attention! A new system error has occurred. Please check your system notifications.',
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
