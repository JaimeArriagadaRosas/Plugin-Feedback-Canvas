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
  'academic_trajectory', 
  'previous_grades', 
  'other_course_performance', 
  'entry_profile', 
  'previous_academic_status'
];

export function createGlobalVariablesRoutes() {
  const router = express.Router();

  // GET /api/variables - To list all available variables (available for admin and teacher)
  router.get('/', (req, res) => {
    // We return the variable map converted into an array
    const variablesArray = Object.entries(DEFAULT_VARIABLES).map(([id, config]) => ({
      id,
      name: `{{${id}}}`,
      desc: config.nombre || id,
      isCustom: !CORE_VARIABLES.includes(id)
    }));
    res.json(variablesArray);
  });

  // POST /api/variables - To create a new variable file (Admin only)
  router.post('/', authorizeRole(['admin']), async (req, res) => {
    try {
      const { name, desc } = req.body;
      if (!name || !desc) {
        return res.status(400).json({ error: 'Name and description are required.' });
      }

      // Validate and clean name
      const cleanName = name.replace(/[{}]/g, '').trim();
      if (!cleanName || !/^[a-zA-Z0-9_]+$/.test(cleanName)) {
        return res.status(400).json({ error: 'The variable name can only contain letters, numbers, and underscores.' });
      }

      // Prevent overwrite
      if (Object.prototype.hasOwnProperty.call(DEFAULT_VARIABLES, cleanName)) {
        return res.status(400).json({ error: 'The variable already exists.' });
      }

      // Generate class name (PascalCase)
      const className = cleanName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('') + 'Resolver';
      const fileName = `${className}.js`;
      const filePath = path.join(variablesDir, fileName);

      // Template for the new variable
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
      // Mock response simulation (RF06)
      return this.sanitize('Simulated data for ${cleanName}: ' + student.name);
    } catch (err) {
      logger.error(\`[${className}] Error resolving variable: \${err.message}\`);
      return '';
    }
  }
}
`;

      // Write file physically (Metaprogramming)
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fs.writeFileSync(filePath, template, 'utf-8');

      // Dynamically reload variables
      loadDynamicVariables();

      res.status(201).json({ message: 'Variable created successfully.', variable: cleanName });
    } catch (error) {
      console.error('[GlobalVariablesRoutes] Error:', error);
      res.status(500).json({ error: 'Internal error creating the variable.' });
    }
  });

  // DELETE /api/variables/:id - To delete a variable (Admin only)
  router.delete('/:id', authorizeRole(['admin']), async (req, res) => {
    try {
      const { id } = req.params;
      
      // Protect core variables
      if (CORE_VARIABLES.includes(id)) {
        return res.status(403).json({ error: 'System variables cannot be deleted.' });
      }

      // Delete physical file
      const className = id.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('') + 'Resolver';
      const fileName = `${className}.js`;
      const filePath = path.join(variablesDir, fileName);

      // eslint-disable-next-line security/detect-non-literal-fs-filename
      if (fs.existsSync(filePath)) {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        fs.unlinkSync(filePath);
      }

      // Delete from memory
      // eslint-disable-next-line security/detect-object-injection
      delete DEFAULT_VARIABLES[id];

      res.status(200).json({ message: 'Variable deleted successfully.' });
    } catch (error) {
      console.error('[GlobalVariablesRoutes] Error deleting:', error);
      res.status(500).json({ error: 'Internal error deleting the variable.' });
    }
  });

  return router;
}
