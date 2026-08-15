import { useState, useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api';
import logger from '../../../utils/logger';

export function useAdminConfig() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(location.state?.activeTab || "RF56");
  const [model, setModel] = useState("gemini-1.5-flash");
  const [service, setService] = useState("gemini");
  const [temperature, setTemperature] = useState(0.7);
  const [maxLength, setMaxLength] = useState(2048);
  const [endpoint, setEndpoint] = useState("https://generativelanguage.googleapis.com/v1beta");
  const [validationError, setValidationError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [tokenValidationError, setTokenValidationError] = useState("");
  const [tokenSaveSuccess, setTokenSaveSuccess] = useState(false);

  const clearErrors = useCallback(() => {
    setValidationError("");
    setSaveSuccess(false);
    setTokenValidationError("");
    setTokenSaveSuccess(false);
  }, []);

  const resetMotor = useCallback(() => {
    setModel("gemini-1.5-flash");
    setTemperature(0.7);
    setMaxLength(2048);
    setEndpoint("https://generativelanguage.googleapis.com/v1beta");
    clearErrors();
  }, [clearErrors]);

  const { data: configuredProviders = [], refetch: fetchConfiguredProviders } = useQuery({
    queryKey: ['config', 'tokens', 'status'],
    queryFn: async () => {
      const response = await api.get('/config/tokens/status');
      if (response.exito) {
        return response.data || [];
      }
      return [];
    },
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  const { data: availableModels = [], isLoading: isLoadingModels } = useQuery({
    queryKey: ['config', 'ia-models', service, configuredProviders],
    queryFn: async () => {
      if (!configuredProviders.includes(service) && service !== 'otros') {
        return [{ id: 'default', name: 'Requiere configurar API Key' }];
      }
      try {
        const response = await api.get(`/config/ia-models?servicio=${service.toLowerCase()}`);
        if (response.exito) {
          return response.data || [];
        }
      } catch (error) {
        // Omite el logger frontend porque el error más probable es credencial corrupta/faltante
      }
      return [{ id: 'default', name: 'Falta configurar token o error de red' }];
    },
    staleTime: 5 * 60 * 1000,
    retry: false
  });

  // Sync model with available models
  useEffect(() => {
    if (availableModels.length > 0 && service !== 'otros') {
      const found = availableModels.find(m => m.id === model);
      if (!found) {
        setModel(availableModels[0].id);
      }
    }
  }, [availableModels, service, model]);

  useEffect(() => {
    if (service === 'gemini') {
      setEndpoint("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash");
    } else if (service === 'openai') {
      setEndpoint("https://api.openai.com/v1/chat/completions");
    } else if (service === 'anthropic') {
      setEndpoint("https://api.anthropic.com/v1/messages");
    } else if (service === 'otros') {
      setEndpoint("");
    }
  }, [service]);

  const resetTokens = useCallback(() => {
    setService("gemini");
    setApiKey("");
    clearErrors();
  }, [clearErrors]);

  const handleSaveMotorConfig = useCallback(async () => {
    setValidationError("");
    setSaveSuccess(false);

    const tempNum = parseFloat(temperature);
    if (isNaN(tempNum) || tempNum < 0.0 || tempNum > 2.0) {
      setValidationError("La temperatura debe ser un valor numérico entre 0.0 y 2.0 (Excepción 1).");
      return;
    }

    const maxTokens = parseInt(maxLength, 10);
    if (isNaN(maxTokens) || maxTokens < 1 || maxTokens > 4096) {
      setValidationError("La longitud máxima (tokens) debe ser un entero entre 1 y 4096 (Excepción 1).");
      return;
    }

    if (!endpoint || (!endpoint.startsWith("http://") && !endpoint.startsWith("https://"))) {
      setValidationError("El endpoint debe ser una dirección URL válida que comience con http:// o https:// (Excepción 1).");
      return;
    }

    try {
      await api.put('/config/ia-model', {
        servicio: service.toLowerCase(),
        modelo: model,
        temperatura: tempNum,
        longitud_maxima: maxTokens,
        endpoint_api: endpoint
      });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (e) {
      logger.error('AdminPanel', 'Error guardando configuración motor IA', { error: e });
      setValidationError(e.message);
    }
  }, [model, temperature, maxLength, endpoint, service]);

  const handleSaveTokenConfig = useCallback(async () => {
    setTokenValidationError("");
    setTokenSaveSuccess(false);

    if (!apiKey || apiKey.trim() === "") {
      setTokenValidationError("Debe ingresar una API key válida.");
      return;
    }

    if (apiKey.trim().length < 10) {
      setTokenValidationError("La API key ingresada es demasiado corta.");
      return;
    }

    try {
      await api.post('/config/tokens', {
        servicio: service.toLowerCase(),
        key: apiKey.trim(),
        endpoint_personalizado: null
      });

      setTokenSaveSuccess(true);
      setApiKey("");
      await queryClient.invalidateQueries({ queryKey: ['config', 'tokens', 'status'] });
      await queryClient.invalidateQueries({ queryKey: ['config', 'ia-models', service] });
      setTimeout(() => setTokenSaveSuccess(false), 4000);
    } catch (error) {
      logger.error('AdminPanel', 'Error guardando token IA', { error });
      setTokenValidationError(error.message || 'Error al guardar el token. Por favor, intente nuevamente.');
    }
  }, [service, apiKey, queryClient]);

  const handleSave = useCallback(() => {
    if (activeTab === "RF55") {
      handleSaveMotorConfig();
    } else if (activeTab === "RF56") {
      handleSaveTokenConfig();
    }
  }, [activeTab, handleSaveMotorConfig, handleSaveTokenConfig]);

  return {
    activeTab,
    setActiveTab,
    model,
    setModel,
    service,
    setService,
    temperature,
    setTemperature,
    maxLength,
    setMaxLength,
    endpoint,
    setEndpoint,
    apiKey,
    setApiKey,
    validationError,
    saveSuccess,
    tokenValidationError,
    tokenSaveSuccess,
    configuredProviders,
    availableModels,
    isLoadingModels,
    handleSave,
    handleSaveMotorConfig,
    handleSaveTokenConfig,
    clearErrors,
    resetMotor,
    resetTokens,
  };
}
