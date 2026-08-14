import express from 'express';
import { authorizeRole } from '../../authz/authorizeRole.js';
import { DEFAULT_VARIABLES, loadDynamicVariables } from '../../domain/variables/CourseVariables.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const variablesDir = path.resolve(__dirname, '../../services/variables');

const CORE_VARIABLES = [
  'trayectoria_academica', 
  'calificaciones_previas', 
  'desempeno_otras_asignaturas', 
  'perfil_ingreso', 
  'situacion_academica_anterior'
];

export function createGlobalVariablesRoutes() {
  const router = express.Router();

  // GET /api/variables - Para listar todas las variables disponibles (disponible para admin y teacher)
  router.get('/', (req, res) => {
    // Retornamos el mapa de variables convirtiéndolo a un array
    const variablesArray = Object.entries(DEFAULT_VARIABLES).map(([id, config]) => ({
      id,
      name: `{{${id}}}`,
      desc: config.nombre || id,
      isCustom: !CORE_VARIABLES.includes(id)
    }));
    res.json(variablesArray);
  });

  // POST /api/variables - Para crear un nuevo archivo de variable (Solo admin)
  router.post('/', authorizeRole(['admin']), async (req, res) => {
    try {
      const { name, desc } = req.body;
      if (!name || !desc) {
        return res.status(400).json({ error: 'Nombre y descripción son requeridos.' });
      }

      // Validar y limpiar el nombre
      const cleanName = name.replace(/[{}]/g, '').trim();
      if (!cleanName || !/^[a-zA-Z0-9_]+$/.test(cleanName)) {
        return res.status(400).json({ error: 'El nombre de la variable solo puede contener letras, números y guiones bajos.' });
      }

      // Evitar sobreescritura
      if (Object.prototype.hasOwnProperty.call(DEFAULT_VARIABLES, cleanName)) {
        return res.status(400).json({ error: 'La variable ya existe.' });
      }

      // Generar nombre de clase (PascalCase)
      const className = cleanName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('') + 'Resolver';
      const fileName = `${className}.js`;
      const filePath = path.join(variablesDir, fileName);

      // Plantilla para la nueva variable
      const template = `import BaseVariableResolver from './BaseVariableResolver.js';
import logger from '../../utils/logger.js';

// NAME: ${desc}

export default class ${className} extends BaseVariableResolver {
  constructor() {
    super('{{${cleanName}}}');
  }

  async resolve(context) {
    const { student } = context;
    if (!student || !student.id) return '';

    try {
      // Simulación de respuesta mockeada (RF06)
      return this.sanitize('Dato simulado para ${cleanName}: ' + student.name);
    } catch (err) {
      logger.error(\`[${className}] Error resolviendo variable: \${err.message}\`);
      return '';
    }
  }
}
`;

      // Escribir archivo físicamente (Metaprogramación)
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.writeFileSync(filePath, template, 'utf-8');

      // Recargar variables dinámicamente
      loadDynamicVariables();

      res.status(201).json({ message: 'Variable creada exitosamente.', variable: cleanName });
    } catch (error) {
      console.error('[GlobalVariablesRoutes] Error:', error);
      res.status(500).json({ error: 'Error interno al crear la variable.' });
    }
  });

  // DELETE /api/variables/:id - Para eliminar una variable (Solo admin)
  router.delete('/:id', authorizeRole(['admin']), async (req, res) => {
    try {
      const { id } = req.params;
      
      // Proteger las variables core
      if (CORE_VARIABLES.includes(id)) {
        return res.status(403).json({ error: 'No se pueden eliminar las variables del sistema.' });
      }

      // Eliminar archivo físico
      const className = id.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('') + 'Resolver';
      const fileName = `${className}.js`;
      const filePath = path.join(variablesDir, fileName);

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (fs.existsSync(filePath)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        fs.unlinkSync(filePath);
      }

      // Eliminar de memoria
      // eslint-disable-next-line security/detect-object-injection
      delete DEFAULT_VARIABLES[id];

      res.status(200).json({ message: 'Variable eliminada exitosamente.' });
    } catch (error) {
      console.error('[GlobalVariablesRoutes] Error al eliminar:', error);
      res.status(500).json({ error: 'Error interno al eliminar la variable.' });
    }
  });

  return router;
}
