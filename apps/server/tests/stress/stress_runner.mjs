import { PostgreSqlContainer } from '@testcontainers/postgresql';
import autocannon from 'autocannon';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  console.log('⏳ Iniciando Testcontainers (PostgreSQL)...');
  const pgContainer = await new PostgreSqlContainer('postgres:15-alpine')
    .withDatabase('test_db')
    .withUsername('test_user')
    .withPassword('test_pass')
    .start();

  process.env.DB_HOST = pgContainer.getHost();
  process.env.DB_PORT = pgContainer.getPort();
  process.env.DB_NAME = 'test_db';
  process.env.DB_USER = 'test_user';
  process.env.DB_PASSWORD = 'test_pass';
  process.env.STARTUP_MODE = '3'; // Modo local (evita OIDC real)
  process.env.PORT = '4001';
  process.env.USE_LOCAL_DATA = 'true';
  process.env.NODE_ENV = 'test';
  process.env.CANVAS_API_URL = 'http://localhost:8443';
  process.env.CANVAS_CLIENT_ID = 'stress_test_client_id';
  process.env.ENABLE_TEST_AUTH_BYPASS = 'true';
  process.env.DEV_TOKEN_SECRET = process.env.DEV_TOKEN_SECRET || 'stress_secret_key_for_testing';
  process.env.DISABLE_RATE_LIMIT = 'true'; // Ignorar rate limits
  process.env.DISABLE_IDEMPOTENCY = 'true'; // Opcional, pero usamos idReplacement

  // Fast boot para no atascarse
  process.env.FAST_BOOT = 'true';
  process.env.LOG_LEVEL = 'error'; // Para que autocannon no se ahogue en logs
  
  // IMPORTANTE: Mocks para la Fase 1 (Estrés profundo de BD)
  // Reemplazamos los métodos a nivel de prototipo para saltarnos la red
  const CanvasLmsAdapterLocal = (await import('../../src/adapters/canvas/CanvasLmsAdapter.local.js')).default;
  CanvasLmsAdapterLocal.prototype.getSubmission = async () => ({ score: 90, points_possible: 100, body: 'Test' });
  CanvasLmsAdapterLocal.prototype.getQuizQuestions = async () => ([]);
  CanvasLmsAdapterLocal.prototype.getRubric = async () => null;
  CanvasLmsAdapterLocal.prototype.getStudents = async () => [{ id: 10, name: 'Student 10' }];
  CanvasLmsAdapterLocal.prototype.getAssignment = async () => ({ id: 100, name: 'Tarea 100' });
  CanvasLmsAdapterLocal.prototype.getAssignments = async () => [{ id: 100, name: 'Tarea 100' }];
  
  const GeminiProvider = (await import('../../src/services/ia/GeminiProvider.js')).default;
  GeminiProvider.prototype.generateFeedback = async () => "Este es un feedback generado súper rápido para pruebas de estrés.";
  
  const AcademicHistoryService = (await import('../../src/services/AcademicHistoryService.js')).default;
  AcademicHistoryService.prototype.getStudentAcademicProfile = async () => ({ history: [] });

  console.log(`🔌 Base de datos efímera lista en ${process.env.DB_HOST}:${process.env.DB_PORT}`);
  console.log('🚀 Arrancando Backend en modo Test...');

  // Importar el entrypoint del servidor (esto ejecutará migraciones automáticamente)
  const { startServer } = await import('../../src/services/server/bootstrap.js');
  const { createApp } = await import('../../src/services/server/middleware.js');
  
  const { app, PORT } = createApp();

  // Inyectar un mock middleware al principio de Express para forzar rol de profesor
  app.use((req, res, next) => {
    // Falsificar sesión LTI
    req.ltiContext = {
      user: 'stress-teacher-123',
      role: 'teacher',
      courseId: 1
    };
    req.canvasToken = 'fake_canvas_token_for_stress';
    req.user = { id: 'stress-teacher-123', role: 'teacher' };
    next();
  });

  const server = await startServer(app, PORT);
  console.log(`✅ Servidor levantado en puerto ${PORT}`);

  console.log('\n🔍 Realizando petición de prueba para diagnosticar error...');
  const { signDevToken } = await import('../../src/security/crypto.js');
  const validToken = signDevToken('dev-token:teacher:1');
  
  try {
    const instance = autocannon({
      url: `https://localhost:${PORT}/api/feedback/generate-all`,
      connections: 50,
      pipelining: 1,
      duration: 10,
      method: 'POST',
      idReplacement: true,
      headers: {
        'content-type': 'application/json',
        'cookie': `dev-token=${validToken}`,
        'idempotency-key': '[<id>]'
      },
      body: JSON.stringify({
        courseId: 1,
        activeAssignments: [{id: 100}],
        students: [{id: 10}],
        isRegenerate: false
      }),
      tlsOptions: {
        rejectUnauthorized: false
      }
    });
    
    // El track se ejecutará sobre la instancia configurada arriba
    autocannon.track(instance, { renderProgressBar: true });

    instance.on('done', async (result) => {
      console.log('\n📊 RESULTADOS DE PRUEBA DE ESTRÉS:');
      console.log(`Latencia Media: ${result.latency.mean} ms`);
      console.log(`Peticiones por Segundo: ${result.requests.average}`);
      console.log(`Errores 5xx/Otros: ${result.non2xx}`);
      console.log(`Timeouts: ${result.timeouts}`);
      console.log(`Total Request: ${result.requests.total}`);
      
      console.log('\n🧹 Limpiando recursos...');
      server.close();
      await pgContainer.stop();
      console.log('✅ Finalizado.');
      process.exit(0);
    });
  } catch (e) {
    console.log('Error en ejecución:', e.message);
  }
}

run().catch(err => {
  console.error('Error crítico:', err);
  process.exit(1);
});
