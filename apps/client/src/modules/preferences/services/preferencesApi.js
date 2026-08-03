import { api } from '@/api';

export const getPreferences = async () => {
  const response = await api.get(`/preferences`);
  return response.data;
};

export const updatePreferences = async (metodo, frecuencia) => {
  const response = await api.put(`/preferences`, { metodo, frecuencia });
  return response.data;
};
