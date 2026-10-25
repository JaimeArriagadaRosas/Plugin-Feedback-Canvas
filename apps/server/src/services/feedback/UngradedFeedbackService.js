import SubmissionContentProcessor from './SubmissionContentProcessor.js';
import DocumentToMarkdownConverter from './DocumentToMarkdownConverter.js';
import RubricContextBuilder from './RubricContextBuilder.js';
import QualitativeFeedbackEvaluator from './QualitativeFeedbackEvaluator.js';
import FeedbackPersistenceHandler from './FeedbackPersistenceHandler.js';

export default class UngradedFeedbackService {
  constructor(gateway, repository, configManager) {
    this.processor = new SubmissionContentProcessor(gateway, new DocumentToMarkdownConverter());
    this.rubricBuilder = new RubricContextBuilder();
    this.evaluator = new QualitativeFeedbackEvaluator(configManager);
    this.persistence = new FeedbackPersistenceHandler(repository);
  }
  async generate({courseId,assignmentId,studentId,teacherId,pending,canvasData,metadata={},singleAttempt=false,preparedContent=null}) {
    const content = preparedContent || await this.processor.process(canvasData.submission, teacherId);
    const rubric = this.rubricBuilder.build(canvasData.assignment,canvasData.rubric);
    const result = await this.evaluator.evaluate({content,rubric,assignment:canvasData.assignment,recipientName:canvasData.student?.name,singleAttempt});
    const studentName = metadata.studentName || canvasData.student?.name || 'Estudiante';
    const assignmentName = metadata.assignmentName || canvasData.assignment?.name || 'Actividad';
    const saved = await this.persistence.saveGeneratedFeedback({
      pending,courseId,assignmentId,studentId,teacherId,
      finalCourseName:metadata.courseName || 'Curso ' + courseId,
      finalAssignmentName:assignmentName,finalStudentName:studentName,
      templateId:null,feedbackText:result.feedback,prompt:result.prompt,
      canvasScore:null,chileGrade:null,approved:null
    });
    if (!saved) throw new Error('No fue posible almacenar el feedback cualitativo');
    return {exito:true,data:{id:saved.id,content:result.feedback,canvasScore:null,chileGrade:null,approved:null,studentName,assignmentName,mode:'qualitative',warnings:result.warnings}};
  }
}
