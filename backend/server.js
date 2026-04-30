// server.js - Main entry point for the Feedback Plugin Backend
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const { sequelize } = require('./config/database');
const ltiRoutes = require('./routes/lti');
const feedbackRoutes = require('./routes/feedback');
const templateRoutes = require('./routes/templates');
const adminRoutes = require('./routes/admin');
const courseRoutes = require('./routes/courses');
const reportRoutes = require('./routes/reports');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
}

// Request logging middleware (dev only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    next();
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'feedback-plugin-backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API info
app.get('/', (req, res) => {
  res.json({
    name: 'Feedback Plugin API',
    version: '1.0.0',
    description: 'Adaptive Feedback Plugin for Canvas LMS',
    endpoints: {
      lti: '/lti/*',
      feedback: '/api/feedback/*',
      templates: '/api/templates/*',
      admin: '/api/admin/*',
      courses: '/api/courses/*',
      reports: '/api/reports/*'
    }
  });
});

// Mount routes
app.use('/lti', ltiRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/reports', reportRoutes);

// Static file serving for frontend
app.use('/static', express.static(path.join(__dirname, '../frontend/src')));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler (must be last)
app.use(errorHandler);

// Database sync and server start
async function startServer() {
  try {
    // Sync database (create tables)
    // In production, use migrations instead
    await sequelize.sync({ alter: process.env.NODE_ENV === 'development' });
    console.log('Database synchronized');
    
    // Create initial data if empty
    await seedInitialData();
    
    app.listen(PORT, () => {
      console.log(`\n🚀 Feedback Plugin Backend running on port ${PORT}`);
      console.log(`   LTI Launch URL: ${process.env.TOOL_URL || 'http://localhost:3001'}/lti/launch`);
      console.log(`   Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
      console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Seed initial templates and AI config
async function seedInitialData() {
  const { Template, AIConfig } = require('./models');
  
  // Check if templates already exist
  const count = await Template.count();
  if (count === 0) {
    console.log('Seeding initial templates...');
    
    const templates = [
      {
        name: 'Feedback Excelente (6.0-7.0)',
        description: 'Plantilla por defecto para calificaciones sobresalientes',
        gradeRange: 'excellent',
        minGrade: 6.0,
        maxGrade: 7.0,
        content: '¡Excelente trabajo, {{nombre_estudiante}}! Tu calificación de {{calificacion}} refleja un dominio sobresaliente de los conceptos vistos en clase. Sigue manteniendo este nivel de dedicación y considera compartir tu conocimiento con compañeros que puedan necesitar apoyo. ¡Felicitaciones por tu logro!',
        variables: ['nombre_estudiante', 'calificacion', 'promedio_curso'],
        createdBy: 1, // admin user
        isSystem: true
      },
      {
        name: 'Feedback Satisfactorio (4.0-5.9)',
        description: 'Plantilla por defecto para calificaciones satisfactorias',
        gradeRange: 'satisfactory',
        minGrade: 4.0,
        maxGrade: 5.9,
        content: 'Buen trabajo, {{nombre_estudiante}}. Has demostrado competencia adecuada con tu calificación de {{calificacion}}. Para seguir mejorando, te recomiendo repasar los materiales de la unidad y practicar con ejercicios adicionales. ¡Tienes el potencial para alcanzar un nivel excelente!',
        variables: ['nombre_estudiante', 'calificacion', 'promedio_curso', 'historial_previo'],
        createdBy: 1,
        isSystem: true
      },
      {
        name: 'Feedback Necesita Mejorar (<4.0)',
        description: 'Plantilla por defecto para calificaciones que requieren apoyo',
        gradeRange: 'needs_improvement',
        minGrade: 0,
        maxGrade: 3.9,
        content: 'Hola {{nombre_estudiante}}, he notado que tuviste dificultades en esta actividad (calificación: {{calificacion}}). No te desanimes, esto es una oportunidad de aprendizaje. Te recomiendo programar una sesión de tutoría, revisar los contenidos de la unidad y no dudar en preguntar. Estoy aquí para apoyarte en tu proceso de mejora. ¡Juntos podemos lograrlo!',
        variables: ['nombre_estudiante', 'calificacion', 'promedio_curso', 'recomendaciones'],
        createdBy: 1,
        isSystem: true
      }
    ];

    for (const t of templates) {
      await Template.create(t);
    }
    console.log('Seeded', templates.length, 'default templates');
  }

  // Seed AI config
  const aiCount = await AIConfig.count();
  if (aiCount === 0) {
    console.log('Seeding AI configuration...');
    await AIConfig.create({
      configKey: 'default',
      provider: 'openai',
      modelName: 'gpt-4o',
      temperature: 0.7,
      maxTokens: 500,
      isActive: true
    });
    console.log('Seeded default AI config');
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  await sequelize.close();
  process.exit(0);
});

startServer();

module.exports = app;
