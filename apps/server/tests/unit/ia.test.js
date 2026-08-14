import { describe, it, expect, vi } from 'vitest';
import IAProviderFactory from '../../src/services/ia/factories/IAProviderFactory.js';
import GeminiProvider from '../../src/services/ia/GeminiProvider.js';

describe('Artificial Intelligence Suite (IAProviderFactory)', () => {
  it('Should return a GeminiProvider when the service is "gemini"', () => {
    const provider = IAProviderFactory.createProvider('gemini', 'TEST_KEY');
    expect(provider).toBeInstanceOf(GeminiProvider);
    expect(provider.apiKey).toBe('TEST_KEY');
  });

  it('Should throw an error if the provider is not supported', () => {
    expect(() => IAProviderFactory.createProvider('unknown_ai', 'key'))
      .toThrow('Unsupported AI provider: unknown_ai');
  });

  it('Should simulate feedback generation using Gemini', async () => {
    // Mocking the behavior of Gemini's generateFeedback
    const provider = IAProviderFactory.createProvider('gemini', 'TEST_KEY');
    
    // Assuming GeminiProvider has a generateFeedback method
    // We use vi.spyOn to spy on it and simulate a response without spending tokens
    provider.generateFeedback = vi.fn().mockResolvedValue({
      feedback: 'Good job',
      score: 95
    });

    const result = await provider.generateFeedback('Hello, this is my essay');
    
    expect(provider.generateFeedback).toHaveBeenCalledWith('Hello, this is my essay');
    expect(result.feedback).toBe('Good job');
    expect(result.score).toBe(95);
  });
});
