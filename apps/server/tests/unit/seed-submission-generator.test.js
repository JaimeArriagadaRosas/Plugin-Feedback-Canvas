import {describe,it,expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.cwd());
const source=fs.readFileSync(path.join(root,'tools/canvas-local/seeds/factories/submission_factory.rb'),'utf8');
const masters=path.join(root,'tools/canvas-local/seeds/masters');
describe('Contrato del generador de entregables sintéticos',()=>{
  it('itera alumnos e identifica las entregas por el usuario actual, sin índice de otro alumno',()=>{
    expect(source).toContain('students.each do |s_data|');
    expect(source).toContain('student_user = User.find(s_data[:id])');
    expect(source).toContain('find_or_create_by!(user_id: student_user.id)');
    expect(source).toContain('student_user.name.gsub');
  });
  it('genera contenido único por alumno y tarea desde un maestro de formato',()=>{
    const generator=fs.readFileSync(path.join(root,'tools/canvas-local/seeds/factories/unique_submission_file.rb'),'utf8');
    expect(source).toContain('UniqueSubmissionFile.create(master_path, file_path, filename: filename, student: student_user, assignment: assignment)');
    expect(generator).toContain('student.id');
    expect(generator).toContain('assignment.id');
    expect(generator).toContain('Prawn::Document.generate');
    expect(source).toContain('"dummy#{chosen_ext}"');
    expect(fs.existsSync(path.join(masters,'dummy.pdf'))).toBe(true);
    expect(fs.existsSync(path.join(masters,'dummy.pptx'))).toBe(true);
    expect(fs.existsSync(path.join(masters,'dummy.xlsx'))).toBe(true);
  });
  it('genera tiempos válidos de inicio y finalización de cuestionarios Canvas',()=>{
    expect(source).toContain('started_at: commenced_at');
    expect(source).toContain('finished_at: completed_at');
    expect(source).toContain('commenced_at = completed_at - rand(5..25).minutes');
  });
  it('asocia el adjunto creado a la entrega, usando el id retornado por Attachment.create',()=>{
    expect(source).toContain('att = Attachment.create!(');
    expect(source).toContain('context: student_user');
    expect(source).toContain('attachment_ids = att.id.to_s');
    expect(source).toContain('attachment_ids: attachment_ids');
  });
});
