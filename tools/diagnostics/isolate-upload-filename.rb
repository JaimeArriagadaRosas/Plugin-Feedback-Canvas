require 'json'
require 'fileutils'
require 'tempfile'
source='/tmp/seeds/masters/dummy.pdf'
raise "Missing fixture #{source}" unless File.exist?(source)
created=[]
begin
  ActiveRecord::Base.transaction(requires_new: true) do
    [[6,'juan_perez_entrega.pdf'],[9,'ana_torres_entrega.pdf']].each do |uid,name|
      user=User.find(uid)
      tmp=Tempfile.new(['seed_upload_', '.pdf'])
      FileUtils.cp(source,tmp.path)
      tmp.close
      input=ActionDispatch::Http::UploadedFile.new(tempfile:File.new(tmp.path),filename:name,type:'application/pdf')
      att=Attachment.create!(context:user,filename:name,display_name:name,uploaded_data:input,workflow_state:'unattached')
      created << {student:user.name, requested:name, input_name:input.original_filename, persisted_name:att.reload.filename,display_name:att.display_name,root_attachment_id:att.root_attachment_id, created_id:att.id}
      tmp.unlink
    end
    raise 'Root attachment mismatch' unless created.all?{|a| a[:root_attachment_id]==2 && a[:persisted_name]=='maria_garcia_entrega.pdf' && a[:display_name]==a[:requested]}
    puts "ISOLATED_GENERATION "+created.to_json
    raise ActiveRecord::Rollback
  end
ensure
  puts "PERSISTENT_NEW_ATTACHMENTS "+created.map{|x| Attachment.exists?(id:x[:created_id])}.to_json
end
