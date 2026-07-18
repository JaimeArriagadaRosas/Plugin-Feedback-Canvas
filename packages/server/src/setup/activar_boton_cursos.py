#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from constants import CANVAS_DIR, RAILS_RUNNER_TIMEOUT
from runner import run_canvas_rails_runner

RUBY_SCRIPT = """
tool = ContextExternalTool.where(name: 'Feedback').where.not(developer_key_id: nil).order(:id).last
if tool
  tab_id = "context_external_tool_#{tool.id}"
  Course.find_each do |course|
    begin
      all_tabs = course.tabs_available(nil, include_hidden_tags: true)
      new_config = []
      tool_found = false
      
      base_tabs = course.tab_configuration.any? ? course.tab_configuration : all_tabs
      
      puts "[Rails-Activador] Analizando curso #{course.id} con #{base_tabs.length} tabs..."
      
      base_tabs.each do |t|
        t_id = (t[:id] || t['id']).to_s
        next unless t_id && !t_id.empty?
        
        # OMITIR herramientas externas antiguas (limpieza de caché)
        if t_id.start_with?('context_external_tool_') && t_id != tab_id
          puts "[Rails-Activador] Omitiendo tool obsoleto en curso #{course.id}: #{t_id}"
          next
        end
        
        t_hidden = t.key?(:hidden) ? t[:hidden] : t['hidden']
        
        if t_id == tab_id
          new_config << { 'id' => t_id, 'hidden' => t_hidden }
          tool_found = true
        else
          new_config << { 'id' => t_id, 'hidden' => t_hidden }
        end
      end
      
      unless tool_found
        new_config << { 'id' => tab_id, 'hidden' => false }
      end
      
      course.tab_configuration = new_config
      course.save!
    rescue => e
      puts "Error procesando curso #{course.id}: #{e.message}"
    end
  end
  puts "ACTIVANDO_TOOL_ID: #{tool.id}"
  puts 'ACTIVACION_COMPLETA'
else
  puts 'LTI_NO_ENCONTRADO'
end
"""

def activar_boton_cursos():
    success, stdout, stderr = run_canvas_rails_runner(
        RUBY_SCRIPT,
        cwd=CANVAS_DIR,
        timeout=RAILS_RUNNER_TIMEOUT,
    )

    if success and "ACTIVACION_COMPLETA" in stdout:
        print(f"\n        [LTI Activador] {stdout.strip()}")
        return True
    if "LTI_NO_ENCONTRADO" in stdout:
        print("\n        [LTI Activador] Herramienta no encontrada en la BD de Canvas.")
        return False

    print(f"\n        [LTI Activador] Error o salida inesperada:\n{stdout}\n{stderr}")
    return False

if __name__ == "__main__":
    exito = activar_boton_cursos()
    sys.exit(0 if exito else 1)
