class CreatePluginTables < ActiveRecord::Migration[7.0]
  def change
    # 1. Tabla Usuarios (Autenticados vía LTI)
    create_table :usuarios, primary_key: :id_usuario do |t|
      t.string :canvas_user_id, null: false, index: { unique: true }
      t.string :nombre_completo, null: false
      t.string :correo_institucional, null: false
      t.string :rol, null: false # 'Profesor', 'Estudiante', 'Administrador'
      t.string :metodo_notificacion_preferido, default: 'in-app'
      t.datetime :fecha_creacion, null: false
      t.datetime :ultima_actividad
    end

    # 2. Configuración LTI
    create_table :configuraciones_lti, primary_key: :id_configuracion do |t|
      t.string :issuer, null: false
      t.string :client_id, null: false, index: { unique: true }
      t.string :deployment_id, null: false
      t.string :auth_login_url, null: false
      t.string :auth_token_url, null: false
      t.string :public_keyset_url, null: false
      t.string :lti_tool_public_key, null: false
      t.string :lti_tool_private_key, null: false # Encriptado AES-256
      
      t.datetime :creado_en, null: false
      t.datetime :actualizado_en
    end

    # 3. Variables de Personalización
    create_table :variables_personalizacion, primary_key: :id_variable do |t|
      t.string :nombre, null: false, index: { unique: true }
      t.string :descripcion, null: false
      t.string :fuente_datos, null: false # 'API_Canvas', 'API_UNAB', 'Valor_Fijo'
      t.boolean :activo_global, default: true
      t.integer :creador_id, null: false # FK a usuarios
      t.datetime :fecha_creacion, null: false
    end
    add_foreign_key :variables_personalizacion, :usuarios, column: :creador_id, primary_key: :id_usuario

    # 4. Configuración IA
    create_table :configuracion_ia, primary_key: :id_configuracion do |t|
      t.string :modelo_activo, null: false
      t.decimal :temperatura, precision: 3, scale: 2, null: false
      t.integer :longitud_maxima, null: false
      t.string :endpoint_api, null: false
      t.string :token_api, null: false # Encriptado AES-256
      t.integer :actualizado_por, null: false # FK a usuarios
      t.datetime :actualizado_en, null: false
    end
    add_foreign_key :configuracion_ia, :usuarios, column: :actualizado_por, primary_key: :id_usuario

    # 5. Plantillas de Feedback
    create_table :plantillas_feedback, primary_key: :id_plantilla do |t|
      t.string :nombre, null: false
      t.string :rango, null: false, index: true # '>=6.0', '4.0-5.9', '<4.0'
      t.text :contenido, null: false
      t.integer :autor_id, null: false, index: true # FK a usuarios
      t.integer :usuario_modificacion_id # FK a usuarios
      t.integer :frecuencia_uso, default: 0
      t.boolean :activo, default: true

      t.datetime :fecha_creacion, null: false
      t.datetime :fecha_modificacion
    end
    add_foreign_key :plantillas_feedback, :usuarios, column: :autor_id, primary_key: :id_usuario
    add_foreign_key :plantillas_feedback, :usuarios, column: :usuario_modificacion_id, primary_key: :id_usuario

    # 6. Historial Académico (Caché local)
    create_table :historial_academico, primary_key: :id_historial do |t|
      t.integer :usuario_id, null: false, index: true
      t.string :canvas_course_id, null: false, index: true
      t.string :canvas_assignment_id, null: false
      t.decimal :calificacion, precision: 3, scale: 1, null: false
      
      t.datetime :fecha_calificacion, null: false
      t.datetime :sincronizado_en, null: false
    end
    add_foreign_key :historial_academico, :usuarios, column: :usuario_id, primary_key: :id_usuario
    add_index :historial_academico, [:usuario_id, :canvas_assignment_id], unique: true, name: 'idx_ha_user_assignment'

    # 7. Configuración de Curso
    create_table :configuracion_curso, primary_key: :id_configuracion do |t|
      t.string :canvas_course_id, null: false
      t.string :canvas_assignment_id, null: false
      t.integer :plantilla_id # FK a plantillas_feedback
      t.boolean :feedback_activo, default: false
      t.integer :variable_id, null: false # FK a variables_personalizacion
      t.boolean :variable_activa, default: false
      t.decimal :ponderacion, precision: 5, scale: 2, null: false, default: 0
      t.integer :profesor_id, null: false # FK a usuarios
      t.datetime :fecha_modificacion, null: false
    end
    add_foreign_key :configuracion_curso, :plantillas_feedback, column: :plantilla_id, primary_key: :id_plantilla
    add_foreign_key :configuracion_curso, :variables_personalizacion, column: :variable_id, primary_key: :id_variable
    add_foreign_key :configuracion_curso, :usuarios, column: :profesor_id, primary_key: :id_usuario
    add_index :configuracion_curso, [:canvas_course_id, :canvas_assignment_id], name: 'idx_cc_course_assignment'

    # 8. Resultados de Feedback
    create_table :resultados_feedback, primary_key: :id_feedback do |t|
      t.integer :plantilla_id, null: false
      t.integer :estudiante_id, null: false, index: true
      t.integer :profesor_id, index: true
      t.string :canvas_course_id, null: false, index: true
      t.string :canvas_assignment_id, null: false
      
      t.decimal :calificacion_original, precision: 3, scale: 1, null: false
      t.string :rango_aplicado, null: false
      t.string :texto_generado, null: false
      t.string :texto_editado
      
      t.string :estado, null: false, default: 'Pendiente', index: true
      t.integer :calificacion_calidad # 1-5
      t.text :nota_privada
      t.integer :utilidad_estudiante # 1-5
      
      t.datetime :fecha_generacion, null: false
      t.datetime :fecha_aprobacion
    end
    add_foreign_key :resultados_feedback, :plantillas_feedback, column: :plantilla_id, primary_key: :id_plantilla
    add_foreign_key :resultados_feedback, :usuarios, column: :estudiante_id, primary_key: :id_usuario
    add_foreign_key :resultados_feedback, :usuarios, column: :profesor_id, primary_key: :id_usuario
    add_index :resultados_feedback, [:estudiante_id, :canvas_assignment_id], unique: true, name: 'idx_rf_student_assignment'

    # 9. Notificaciones
    create_table :notificaciones, primary_key: :id_notificacion do |t|
      t.integer :feedback_id, null: false
      t.integer :destinatario_id, null: false
      t.string :canal, null: false # 'in-app', 'correo'
      t.string :contenido, null: false
      t.string :estado_entrega, null: false # 'Enviado', 'Fallido'
      t.datetime :fecha_envio, null: false
    end
    add_foreign_key :notificaciones, :resultados_feedback, column: :feedback_id, primary_key: :id_feedback
    add_foreign_key :notificaciones, :usuarios, column: :destinatario_id, primary_key: :id_usuario

    # 10. Logs de Auditoría
    create_table :logs_auditoria, primary_key: :id_log do |t|
      t.integer :usuario_id, index: true
      t.string :rol
      t.string :accion, null: false
      t.string :ip_origen, null: false
      t.string :endpoint, null: false
      t.string :resultado, null: false # 'OK', 'Denegado', 'Error'
      t.datetime :fecha, null: false, index: true
    end
    add_foreign_key :logs_auditoria, :usuarios, column: :usuario_id, primary_key: :id_usuario
  end
end
