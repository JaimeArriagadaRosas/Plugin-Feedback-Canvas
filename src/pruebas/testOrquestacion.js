import FeedbackService from '../servicios/FeedbackService.js';
import GeminiProvider from '../servicios/ia/GeminiProvider.js';
import CanvasServiceMock from '../servicios/CanvasService.mock.js';
import FeedbackRepository from '../datos/FeedbackRepository.js';
import TemplateRepository from '../datos/TemplateRepository.js';

async function testFlow() {
  console.log('--- TEST DE ORQUESTACIÓN DE FEEDBACK ---');

  // 1. Setup de componentes
  const iaProvider = new GeminiProvider('mock-api-key');
  const canvasService = new CanvasServiceMock('token', 'https://canvas.instructure.com');
  const feedbackRepo = new FeedbackRepository({});
  const templateRepo = new TemplateRepository({});

  const orquestador = new FeedbackService(iaProvider, canvasService, feedbackRepo, templateRepo);

  // 2. Ejecución del flujo
  try {
    const result = await orquestador.generateFeedback(
      123, // courseId
      456, // assignmentId
      789, // studentId
      1    // templateId
    );

    console.log('\n--- RESULTADO FINAL ---');
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error en el test:', error);
  }
}

testFlow();
