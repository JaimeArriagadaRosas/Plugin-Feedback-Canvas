# canvas_db_cleaner.rb
# Módulo dedicado EXCLUSIVAMENTE a borrar herramientas corruptas de la BD de Canvas.

def fail_with(message)
  puts "ERROR: #{message}"
  exit 1
end

begin
  puts "[Canvas Cache Cleaner] Iniciando limpieza profunda de BD..."
  
  # Buscar todas las herramientas externas antiguas
  tools_to_delete = ContextExternalTool.where(name: ['Feedback', 'Test LTI', 'Prueba Local'])
  
  # También borrar cualquier herramienta que apunte a localhost:3000 y no sea la nuestra
  tools_to_delete += ContextExternalTool.where("url LIKE '%localhost:3000%'")
  
  if tools_to_delete.any?
    tools_to_delete.uniq.each do |t|
      puts "[Canvas Cache Cleaner] Eliminando herramienta impostora/obsoleta: Nombre='#{t.name}', URL='#{t.url}', ID=#{t.id}"
      t.destroy
    end
  else
    puts "[Canvas Cache Cleaner] No se encontraron herramientas obsoletas por nombre o URL."
  end
  
  # También eliminar si hay alguna asociada a la DeveloperKey que vamos a usar
  key = DeveloperKey.where(name: 'Plugin Feedback LTI').first
  if key
    tools_by_key = ContextExternalTool.where(developer_key_id: key.id)
    if tools_by_key.any?
      puts "[Canvas Cache Cleaner] Encontradas #{tools_by_key.count} herramientas atadas a la Developer Key actual (ID: #{key.id})."
      tools_by_key.each do |t|
        puts "[Canvas Cache Cleaner] Eliminando tool atada a la key: ID=#{t.id}"
        t.destroy
      end
    else
      puts "[Canvas Cache Cleaner] La Developer Key actual está limpia de herramientas atadas."
    end
  else
    puts "[Canvas Cache Cleaner] Developer Key 'Plugin Feedback LTI' no existe aún."
  end
  
  puts "[Canvas Cache Cleaner] Limpiando caché de Rails para evitar URLs LTI antiguas (HTTP/HTTPS mismatch)..."
  # NOTA: no usar Rails.cache.clear. Con Redis habilitado (requerido para el
  # flujo LTI 1.3), Rails.cache.clear invoca flushdb, que Canvas bloquea fuera
  # de la consola (RedisClient.with_dangerous_redis_methods) y hace fallar todo
  # el arranque. En su lugar limpiamos solo las entradas de caché de
  # herramientas externas, que es lo que realmente importa aquí.
  if defined?(Rails) && Rails.respond_to?(:cache) && Rails.cache.respond_to?(:delete_matched)
    begin
      Rails.cache.delete_matched(/external_tool/) rescue nil
      Rails.cache.delete_matched(/lti_/i) rescue nil
    rescue => e
      puts "[Canvas Cache Cleaner] AVISO: no se pudo limpiar caché de tools LTI: #{e.message}"
    end
  end

  puts "CLEANUP_SUCCESS"
rescue => e
  fail_with("Error durante la limpieza: #{e.message}")
end
