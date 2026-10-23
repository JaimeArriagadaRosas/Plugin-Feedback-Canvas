import { describe, it, expect, vi } from 'vitest';
import SubmissionContentProcessor from '../../src/services/feedback/SubmissionContentProcessor.js';
import DocumentToMarkdownConverter from '../../src/services/feedback/DocumentToMarkdownConverter.js';
import SubmissionAttachmentDownloader from '../../src/adapters/canvas/SubmissionAttachmentDownloader.js';

describe('Regresión: archivo entregado pero inaccesible', () => {
  it('no evalúa el texto de acompañamiento si el PPTX no se puede descargar', async () => {
    const gateway = {downloadSubmissionAttachment:vi.fn().mockRejectedValue(new Error('HTTP 403'))};
    const processor = new SubmissionContentProcessor(gateway,new DocumentToMarkdownConverter());
    await expect(processor.process({
      workflow_state:'submitted',body:'Se ha adjuntado el archivo pedro_entrega.pptx.',
      attachments:[{id:42,filename:'pedro_entrega.pptx'}]
    },7)).rejects.toMatchObject({errorCode:'ATTACHMENT_UNREADABLE'});
  });
  it('incluye autorización al descargar desde el mismo origen de Canvas', async () => {
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async (_url,options) => ({
      ok:true,status:200,headers:new Headers({'content-type':'application/pdf'}),
      arrayBuffer:async()=>Uint8Array.of(37,80,68,70).buffer
    }));
    try {
      const adapter = {
        httpClient:{canvasBaseUrl:'https://canvas.example.edu'},
        _fetchWithToken:vi.fn(async()=>({url:'https://canvas.example.edu/files/42/download',content_type:'application/pdf'})),
        resolveToken:vi.fn(async()=> 'test-token')
      };
      const output = await new SubmissionAttachmentDownloader(adapter).download({id:42},7);
      expect(output.mime).toBe('application/pdf');
      expect(globalThis.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token');
    } finally {globalThis.fetch=original;}
  });
  it('corrige HTTP en puerto TLS 8443 y reutiliza credenciales y dispatcher', async () => {
    const original = globalThis.fetch;
    const calls = [];
    globalThis.fetch = vi.fn(async (url, options) => {
      calls.push({url:String(url),options});
      if (calls.length === 1) return { status:302,headers:new Headers({location:'http://localhost:8443/files/3/download'}) };
      return { ok:true,status:200,headers:new Headers({'content-type':'application/pdf'}),
        arrayBuffer:async()=>Uint8Array.of(37,80,68,70).buffer };
    });
    try {
      const dispatcher = { testDispatcher: true };
      const adapter = {
        httpClient:{ canvasBaseUrl:'https://localhost:8443',dispatcher },
        _fetchWithToken:vi.fn(async()=>({url:'http://localhost:8080/files/3/download',content_type:'application/pdf'})),
        resolveToken:vi.fn(async()=> 'test-token')
      };
      const result=await new SubmissionAttachmentDownloader(adapter).download({id:3,filename:'pedro.pptx'},1);
      expect(result.buffer.length).toBe(4);
      expect(calls).toHaveLength(2);
      expect(calls[1].url).toBe('https://localhost:8443/files/3/download');
      expect(calls[1].options.headers.Authorization).toBe('Bearer test-token');
      expect(calls[1].options.dispatcher).toBe(dispatcher);
    } finally {globalThis.fetch=original;}
  });
});
