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
  it('usa un maestro compartido por formato y no contenido individual por alumno',()=>{
    expect(source).toContain('"dummy#{chosen_ext}"');
    expect(source).toContain('FileUtils.cp(master_path, file_path)');
    expect(fs.existsSync(path.join(masters,'dummy.pdf'))).toBe(true);
    expect(fs.existsSync(path.join(masters,'dummy.pptx'))).toBe(true);
    expect(fs.existsSync(path.join(masters,'dummy.xlsx'))).toBe(true);
  });
  it('asocia el adjunto creado a la entrega, usando el id retornado por Attachment.create',()=>{
    expect(source).toContain('att = Attachment.create!(');
    expect(source).toContain('context: student_user');
    expect(source).toContain('attachment_ids = att.id.to_s');
    expect(source).toContain('attachment_ids: attachment_ids');
  });
});
