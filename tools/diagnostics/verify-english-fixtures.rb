require '/tmp/unique_submission_file_english'
require 'digest'
require 'zip'
Student=Struct.new(:id,:name)
Task=Struct.new(:id,:title)
students=[Student.new(6,'John Smith'),Student.new(9,'Anna Brown')]
files=[]
students.each do |student|
  output="/tmp/english_fixture_#{student.id}.pptx"
  UniqueSubmissionFile.create('/tmp/english_master.pptx', output, filename:output,student:student,assignment:Task.new(2,'Software Architecture'))
  files << output
  text=Zip::File.open(output){|zip|zip.entries.select{|e|e.name.match?(%r{\Appt/slides/slide\d+\.xml\z})}.map{|e|e.get_input_stream.read}.join(' ').force_encoding('UTF-8')}
  raise 'Spanish fixture content remains' if text.match?(/Arquitectura de Microservicios|Evoluci[oó]n|Secci[oó]n/)
  raise 'English fixture content missing' unless text.include?('Microservices Architecture') && text.include?(student.name)
  puts "OK student_id=#{student.id} English PPTX #{File.size(output)} bytes"
end
raise 'Identical PPTX for two students' if Digest::SHA256.file(files[0]).hexdigest == Digest::SHA256.file(files[1]).hexdigest
puts 'OK English PPTX files unique'
files.each{|file|File.delete(file)}
