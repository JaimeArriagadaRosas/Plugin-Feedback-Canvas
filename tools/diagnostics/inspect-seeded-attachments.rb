# frozen_string_literal: true
require 'json'
puts "ATTACHMENTS"
Attachment.where(id: 1..30).order(:id).each do |a|
  puts({id:a.id,filename:a.filename,owner:a.context_id,owner_type:a.context_type,created:a.created_at,updated:a.updated_at,uuid:a.uuid}.to_json)
end
puts "SUBMISSIONS"
Submission.where(assignment_id: [2,5,8,11,14]).order(:assignment_id,:user_id).each do |s|
  puts({id:s.id,assignment:s.assignment_id,user:s.user_id,user_name:s.user&.name,course:s.assignment&.context_id,attachment_ids:s.attachment_ids,attachments:s.attachments.map{|a|{id:a.id,filename:a.filename,owner:a.context_id}},submitted:s.submitted_at,updated:s.updated_at,body:s.body&.slice(0,120)}.to_json)
end
