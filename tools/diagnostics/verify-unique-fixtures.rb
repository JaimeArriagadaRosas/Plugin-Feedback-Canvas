require '/tmp/unique_submission_file'
require 'digest'
a=Struct.new(:id,:name).new(9,'Ana Torres')
b=Struct.new(:id,:title).new(5,'Ensayo')
c=Struct.new(:id,:name).new(7,'Maria Garcia')
%w[pdf pptx xlsx zip].each do |ext|
  fa="/tmp/check_ana_#{ext}.#{ext}"
  fm="/tmp/check_maria_#{ext}.#{ext}"
  master="/tmp/seeds/masters/dummy.#{ext}"
  begin
    UniqueSubmissionFile.create(master,fa,filename:fa,student:a,assignment:b)
    UniqueSubmissionFile.create(master,fm,filename:fm,student:c,assignment:b)
    different=Digest::SHA256.file(fa).hexdigest != Digest::SHA256.file(fm).hexdigest
    puts "#{ext}: bytes #{File.size(fa)} / #{File.size(fm)}, unique=#{different}"
    raise "#{ext} was not unique" unless different
    if ext=='.pptx'
      raise 'pptx not readable' unless Zip::File.open(fa){|z|z.entries.any?{|e|e.name.start_with?('ppt/slides/slide')}}
    end
  ensure
    File.delete(fa) if File.exist?(fa)
    File.delete(fm) if File.exist?(fm)
  end
end
