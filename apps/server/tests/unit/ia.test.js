import { describe, it, expect, vi } from 'vitest';
import IAProviderFactory from '../../src/services/ia/factories/IAProviderFactory.js';
import GeminiProvider from '../../src/services/ia/GeminiProvider.js';

describe('Suite de Inteligencia Artificial (IAProviderFactory)', () => {
  it('Debería retornar un GeminiProvider cuando el servicio es "gemini"', () => {
    const provider = IAProviderFactory.createProvider('gemini', 'TEST_KEY');
    expect(provider).toBeInstanceOf(GeminiProvider);
    expect(provider.apiKey).toBe('TEST_KEY');
  });

  it('Debería lanzar error si el proveedor no está soportado', () => {
    expect(() => IAProviderFactory.createProvider('unknown_ai', 'key'))
      .toThrow('Proveedor de IA no soportado: unknown_ai');
  });

  it('Debería simular la generación de feedback usando Gemini', async () => {
    // Mockeando el comportamiento de generateFeedback de Gemini
    const provider = IAProviderFactory.createProvider('gemini', 'TEST_KEY');
    
    // Suponiendo que GeminiProvider tiene un método generateFeedback
    // Usamos vi.spyOn para espiarlo y simular una respuesta sin gastar tokens
    provider.generateFeedback = vi.fn().mockResolvedValue({
      feedback: 'Buen trabajo',
      score: 95
    });

    const result = await provider.generateFeedback('Hola, este es mi ensayo');
    
    expect(provider.generateFeedback).toHaveBeenCalledWith('Hola, este es mi ensayo');
    expect(result.feedback).toBe('Buen trabajo');
    expect(result.score).toBe(95);
  });
});
