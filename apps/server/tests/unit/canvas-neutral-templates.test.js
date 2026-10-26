import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import CanvasScorePolicy from '../../src/services/calificaciones/CanvasScorePolicy.js';
import TemplateManager from '../../src/services/TemplateManager.js';
import PromptManager from '../../src/services/PromptManager.js';
import GradeResolver from '../../src/services/variables/GradeResolver.js';
import CourseAverageResolver from '../../src/services/variables/CourseAverageResolver.js';

describe('Canvas-neutral default templates', () => {
 const repo=fs.readFileSync(new URL('../../src/data/TemplateRepository.js',import.meta.url),'utf8');
 const editor=fs.readFileSync(new URL('../../../client/src/views/templates/hooks/useTemplateEditor.js',import.meta.url),'utf8');
 it('all three database defaults omit grade and average tags',()=>{
  const seeded=repo.slice(repo.indexOf("('Standard Class'"),repo.indexOf("', NULL);")+9);
  expect(seeded).not.toMatch(/\{\{grade\}\}|\{\{course_average\}\}|Your grade/);
 });
 it('new-template default content omits both academic variables',()=>{
  const initial=editor.split('let initialContent = {')[1].split('};')[0];
  expect(initial).not.toMatch(/\{\{grade\}\}|\{\{course_average\}\}|Your grade/);
 });
 it.each([[0,100,'bajo'],[59.9,100,'bajo'],[60,100,'medio'],[85.9,100,'medio'],[86,100,'alto'],[43,50,'alto'],[8.6,10,'alto']])('score %s of %s => %s',(score,max,range)=>{
  expect(CanvasScorePolicy.classify(score,max).range).toBe(range);
 });
 it('invalid points cannot be classified',()=>{
  expect(()=>CanvasScorePolicy.classify(1,0)).toThrow();
 });
 it('chooses correct range and preserves Canvas units',async()=>{
  const manager=new TemplateManager({getById:vi.fn().mockResolvedValue({contenido:JSON.stringify({alto:'HIGH',medio:'MEDIUM',bajo:'LOW'})})});
  const chosen=await manager.getTemplateForScore(1,43,50);
  expect(chosen.contenido).toBe('HIGH');
  expect(chosen.instructionIA).toContain('43 out of 50');
  expect(chosen.instructionIA).not.toMatch(/Chile|7\.0/);
 });
 it('optional variables disappear with their sentence when missing',async()=>{
  const result=await PromptManager.buildPrompt('Dear Alex,\n\nYour grade is {{grade}}.\nThe course average is {{course_average}}.\nContinue improving.',{submission:{}},[new GradeResolver(),new CourseAverageResolver()]);
  expect(result).toBe('Dear Alex,\n\nContinue improving.');
 });
 it('teacher-added score variable resolves only Canvas points',async()=>{
  const result=await new GradeResolver().resolve({submission:{score:42,pointsPossible:50}});
  expect(result).toBe('42 out of 50 points');
 });
});
