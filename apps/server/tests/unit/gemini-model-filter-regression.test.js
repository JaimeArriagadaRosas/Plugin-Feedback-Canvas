import { describe, expect, it, vi, afterEach } from 'vitest';
import GeminiProvider from '../../src/services/ia/GeminiProvider.js';

afterEach(() => vi.unstubAllGlobals());
const model = (name, methods=['generateContent'], displayName=name) => ({
  name: 'models/' + name, displayName, supportedGenerationMethods: methods
});
describe('Gemini model discovery compatibility', () => {
  it('keeps compatible text models from the provider API, without hardcoded replacement', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:true, json:async()=>({models:[model('gemini-compatible-text')]})
    }));
    const result = await new GeminiProvider('test-key').fetchAvailableModels();
    expect(result.some(m=>m.id==='gemini-compatible-text')).toBe(true);
  });
  it('removes image-only and TTS-only models even when advertised as generateContent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:true, json:async()=>({models:[
        model('gemini-compatible-text'),
        model('gemini-image-preview',['generateContent']),
        model('gemini-tts-preview',['generateContent'])
      ]})
    }));
    const result = await new GeminiProvider('test-key').fetchAvailableModels();
    expect(result.map(m=>m.id)).toEqual(['gemini-compatible-text']);
  });
  it('ignores models without generateContent and tolerates missing methods', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:true, json:async()=>({models:[
        model('embeddings',['embedContent']),
        {name:'models/missing-methods',displayName:'No methods'},
        model('text-good',['generateContent'])
      ]})
    }));
    const result = await new GeminiProvider('test-key').fetchAvailableModels();
    expect(result.map(m=>m.id)).toEqual(['text-good']);
  });
});
