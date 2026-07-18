# Suite de Validación de Caja Negra

Pruebas automatizadas del backend del Plugin Feedback Adaptativo para Canvas LMS.

## Estructura

```
validación/
├── setup/            # App Express en-process, BD de prueba, factories, mocks
├── contratos/        # Schemas Zod para validación de respuestas API
├── rutas/            # Tests de endpoints HTTP (Supertest)
├── servicios/        # Tests de lógica de negocio
├── integración/      # Flujos completos con BD real
├── regresión/        # Tests para bugs conocidos documentados
├── report/           # Generación de reportes JSON
└── README.md         # Esta guía
```

## Requisitos

- Node.js >= 18
- PostgreSQL corriendo (local o Docker)
- Dependencias instaladas: `npm install`

## Ejecución

```bash
# Suite completa
npm run test

# Watch mode (desarrollo)
npm run test:watch

# Solo integración
npm run test:integration

# Solo regresión
npm run test:regression
```

## Convenciones

- Tests de rutas: `*.test.js` con Supertest contra app en-process.
- Tests de integración: `*.integration.test.js` con BD truncada entre tests.
- Tests de regresión: `*.test.js` en carpeta `regresión/`.
- Nombres descriptivos: `it('retorna 401 sin token LTI', ...)`.
- Aislamiento: truncate de BD en `beforeEach`.
