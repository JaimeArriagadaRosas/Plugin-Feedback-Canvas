import { describe, expect, it, vi, afterEach } from 'vitest';
import GeminiProvider from '../../src/services/ia/GeminiProvider.js';

afterEach(() => vi.unstubAllGlobals());
const model = (name, methods=['generateContent'], displayName=name) => ({
  name: 'models/' + name, displayName, supportedGenerationMethods: methods
});
describe('Gemini model discovery compatibility', () => {
  it('keeps compatible text models from the provider API, without hardcoded replacement', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:true, json:async()=>({models:[model('gemini-3.6-flash')]})
    }));
    const result = await new GeminiProvider('test-key').fetchAvailableModels();
    expect(result.some(m=>m.id==='gemini-3.6-flash')).toBe(true);
  });
  it('removes image-only and TTS-only models even when advertised as generateContent', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:true, json:async()=>({models:[
        model('gemini-3.6-flash'),
        model('gemini-image-preview',['generateContent']),
        model('gemini-tts-preview',['generateContent'])
      ]})
    }));
    const result = await new GeminiProvider('test-key').fetchAvailableModels();
    expect(result.map(m=>m.id)).toEqual(['gemini-3.6-flash']);
  });
  it('rejects all older Gemini versions and non-versioned aliases', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:true, json:async()=>({models:[
        model('gemini-2.5-flash'),model('gemini-3.0-pro'),model('gemini-3.1-flash'),
        model('gemini-3.5-flash'),model('gemini-flash-latest'),model('gemini-pro-latest'),
        model('gemini-3.6-flash'),model('gemini-3.7-pro')
      ]})
    }));
    const result = await new GeminiProvider('test-key').fetchAvailableModels();
    expect(result.map(m=>m.id)).toEqual(['gemini-3.6-flash','gemini-3.7-pro']);
  });
  it('ignores models without generateContent and tolerates missing methods', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok:true, json:async()=>({models:[
        model('embeddings',['embedContent']),
        {name:'models/missing-methods',displayName:'No methods'},
        model('gemini-3.6-pro',['generateContent'])
      ]})
    }));
    const result = await new GeminiProvider('test-key').fetchAvailableModels();
    expect(result.map(m=>m.id)).toEqual(['gemini-3.6-pro']);
  });
});
