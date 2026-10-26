import {describe,it,expect,vi} from 'vitest';
import fs from 'node:fs';
import CanvasScorePolicy from '../../src/services/calificaciones/CanvasScorePolicy.js';
import TemplateManager from '../../src/services/TemplateManager.js';
import PromptManager from '../../src/services/PromptManager.js';
import GradeResolver from '../../src/services/variables/GradeResolver.js';
import CourseAverageResolver from '../../src/services/variables/CourseAverageResolver.js';
describe('plantillas y puntuaciones neutrales en español',()=>{
 it('tres plantillas originales sin promedio ni calificación',()=>{
  const s=fs.readFileSync(new URL('../../src/data/TemplateRepository.js',import.meta.url),'utf8');
  const seeded=s.slice(s.indexOf("('Clase Estándar'"),s.indexOf("', NULL);")+9);
  expect(seeded).not.toMatch(/\{\{calificacion\}\}|\{\{promedio_curso\}\}/);
 });
 it('plantilla nueva no trae calificación ni promedio',()=>{
  const s=fs.readFileSync(new URL('../../../client/src/views/plantillas/hooks/useTemplateEditor.js',import.meta.url),'utf8');
  const initial=s.split('let initialContent = {')[1].split('};')[0];
  expect(initial).not.toMatch(/\{\{calificacion\}\}|\{\{promedio_curso\}\}/);
 });
 it.each([[0,100,'bajo'],[59.9,100,'bajo'],[60,100,'medio'],[85.9,100,'medio'],[86,100,'alto'],[43,50,'alto'],[8.6,10,'alto']])('puntaje %s/%s corresponde a %s',(score,max,range)=>{
  expect(CanvasScorePolicy.classify(score,max).range).toBe(range);
 });
 it('no clasifica puntajes con máximo inválido',()=>{
  expect(()=>CanvasScorePolicy.classify(1,0)).toThrow();
 });
 it('selecciona tono alto sin convertir a escala chilena',async()=>{
  const repo={getById:vi.fn().mockResolvedValue({contenido:JSON.stringify({alto:'ALTO',medio:'MEDIO',bajo:'BAJO'})})};
  const result=await new TemplateManager(repo).getTemplateForScore(1,43,50);
  expect(result.contenido).toBe('ALTO');
  expect(result.instructionIA).toContain('43 de 50 puntos');
  expect(result.instructionIA).not.toContain('nota chilena');
 });
 it('omitir frases opcionales sin datos y preservar resto',async()=>{
  const text='Hola.\n\nNota: {{calificacion}}\nPromedio: {{promedio_curso}}\nBuen trabajo.';
  const out=await PromptManager.buildPrompt(text,{submission:{}},[new GradeResolver(),new CourseAverageResolver()]);
  expect(out).toBe('Hola.\n\nBuen trabajo.');
 });
 it('variable calificación voluntaria muestra puntos de Canvas',async()=>{
  expect(await new GradeResolver().resolve({submission:{score:42,pointsPossible:50}})).toBe('42 de 50 puntos');
 });
});
