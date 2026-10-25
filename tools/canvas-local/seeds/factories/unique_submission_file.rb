# frozen_string_literal: true
require 'fileutils'
require 'digest'
require 'zip'
require 'prawn'

module UniqueSubmissionFile
  def self.create(master_path, output_path, filename:, student:, assignment:)
    FileUtils.mkdir_p(File.dirname(output_path))
    marker = "Synthetic submission | student #{student.id} #{student.name} | assignment #{assignment.id} #{assignment.title}"
    ext = File.extname(output_path).downcase
    case ext
    when '.pdf'
      Prawn::Document.generate(output_path) do |pdf|
        pdf.text(marker)
        pdf.move_down(12)
        pdf.text('Test assignment: analyze software architecture, benefits and limitations of microservices.')
      end
    when '.pptx', '.xlsx'
      raise "Missing template #{master_path}" unless File.file?(master_path)
      entries = {}
      Zip::File.open(master_path) { |zip| zip.each { |entry| entries[entry.name] = entry.get_input_stream.read unless entry.directory? } }
      if ext == '.pptx'
        slide = entries.keys.grep(%r{\Appt/slides/slide[0-9]+\.xml\z}).min
        raise 'PPTX has no slides' unless slide
        safe = marker.gsub('&','&amp;').gsub('<','&lt;').gsub('>','&gt;')
        entries[slide] = entries[slide].force_encoding('UTF-8').sub('</p:spTree>', "<p:sp><p:nvSpPr><p:cNvPr id=\"999\" name=\"Test identifier\"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang=\"en-US\"/><a:t>#{safe}</a:t></a:r></a:p></p:txBody></p:sp></p:spTree>")
      else
        # XLSX is not an accepted feedback format, but each fixture must remain unique.
        entries['docProps/custom.xml'] = %Q(<?xml version="1.0" encoding="UTF-8"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="FixtureIdentity"><vt:lpwstr>#{marker}</vt:lpwstr></property></Properties>)
        types = entries['[Content_Types].xml']
        entries['[Content_Types].xml'] = types.sub('</Types>','<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>') if types
      end
      Zip::File.open(output_path,create:true) { |zip| entries.each { |name, data| zip.get_output_stream(name) { |out| out.write(data) } } }
    when '.zip'
      Zip::File.open(output_path,create:true) { |zip| zip.get_output_stream('submission.txt') { |out| out.write(marker) } }
    else
      raise "Unsupported fixture format: #{ext}"
    end
    raise 'Empty fixture' if File.size(output_path).zero?
    output_path
  end
end
