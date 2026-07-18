class CreatePluginTables < ActiveRecord::Migration[7.0]
  tag :predeploy

  def change
    # 1. Tabla de Plantillas de Feedback
    create_table :plantilla_feedbacks do |t|
      t.string :nombre, null: false
      t.text :contenido, null: false
      t.datetime :creado_en, default: -> { 'CURRENT_TIMESTAMP' }
      t.datetime :actualizado_en, default: -> { 'CURRENT_TIMESTAMP' }
    end

    # 2. Historial de Feedbacks Generados
    create_table :historial_feedback_generados do |t|
      t.string :estudiante_id, limit: 50, null: false
      t.string :curso_id, limit: 50, null: false
      t.string :tarea_id, limit: 50, null: false
      t.bigint :plantilla_feedback_id
      t.text :contenido_generado, null: false
      t.text :prompt_usado
      t.integer :nota_canvas
      t.decimal :nota_chile, precision: 3, scale: 1
      t.boolean :aprobado
      t.string :estado, limit: 20, default: 'generado'
      t.integer :calificacion_profesor
      t.integer :calificacion_estudiante
      t.datetime :fecha_generacion, default: -> { 'CURRENT_TIMESTAMP' }
    end
    add_index :historial_feedback_generados, :estudiante_id, name: 'idx_historial_estudiante'
    add_index :historial_feedback_generados, :curso_id, name: 'idx_historial_curso'

    # 3. Configuraciones por Curso y Asignación
    create_table :configuracion_curso_tareas do |t|
      t.string :contexto_tipo, limit: 20, null: false
      t.string :contexto_id, limit: 50, null: false
      t.jsonb :config_json, null: false
      t.datetime :actualizado_en, default: -> { 'CURRENT_TIMESTAMP' }
    end
    add_index :configuracion_curso_tareas, [:contexto_tipo, :contexto_id], unique: true, name: 'idx_config_curso_tareas'

    # 4. Tokens y Llaves de API de Servicios IA
    create_table :llaves_api_ia do |t|
      t.string :servicio, limit: 50, null: false
      t.text :api_key_encriptada, null: false
      t.boolean :activo, default: true
      t.datetime :ultima_verificacion
    end

    # 5. Historial Académico de Estudiantes (Cache Local)
    create_table :historial_academico_locales do |t|
      t.string :estudiante_id, limit: 50, null: false
      t.string :curso_id, limit: 50, null: false
      t.jsonb :resumen_desempeno
      t.datetime :ultimo_sync, default: -> { 'CURRENT_TIMESTAMP' }
    end
    add_index :historial_academico_locales, [:estudiante_id, :curso_id], unique: true, name: 'idx_historial_academico_loc'

    # 6. Logs de Auditoría
    create_table :logs_auditoria do |t|
      t.string :usuario_id, limit: 50, null: false
      t.string :accion, limit: 100, null: false
      t.text :detalle
      t.datetime :fecha, default: -> { 'CURRENT_TIMESTAMP' }
    end

    # 7. Historial de Notificaciones
    create_table :notificaciones_feedbacks do |t|
      t.string :estudiante_id, limit: 50, null: false
      t.bigint :historial_feedback_generado_id
      t.text :mensaje, null: false
      t.string :metodo, limit: 20, default: 'email'
      t.datetime :enviado_en, default: -> { 'CURRENT_TIMESTAMP' }
    end
  end
end
