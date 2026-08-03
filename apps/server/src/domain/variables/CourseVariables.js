import { DomainError } from '../../utils/errors.js';

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const variablesDir = path.resolve(__dirname, '../../services/variables');

/* eslint-disable security/detect-object-injection */
export const DEFAULT_VARIABLES = {
  trayectoria_academica: { activa: true, ponderacion: 20, nombre: 'Trayectoria académica en el curso' },
  calificaciones_previas: { activa: true, ponderacion: 20, nombre: 'Calificaciones previas' },
  desempeno_otras_asignaturas: { activa: true, ponderacion: 20, nombre: 'Desempeño en otras asignaturas' },
  perfil_ingreso: { activa: true, ponderacion: 20, nombre: 'Perfil de ingreso' },
  situacion_academica_anterior: { activa: true, ponderacion: 20, nombre: 'Situación académica anterior' }
};

// Variables del sistema o de plantilla que NO deben aparecer en la configuración de ponderación
const EXCLUDED_VARIABLES = ['promedio_curso', 'calificacion', 'nombre_estudiante'];

// Carga dinámica de variables adicionales (RF06)
export function loadDynamicVariables() {
  try {
    const files = fs.readdirSync(variablesDir);
    for (const file of files) {
      if (file.endsWith('Resolver.js') && file !== 'BaseVariableResolver.js') {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const content = fs.readFileSync(path.join(variablesDir, file), 'utf-8');
        const match = content.match(/super\(['"]\{\{(.*?)\}\}['"]\)/);
        if (match && match[1]) {
          const key = match[1];
          if (!DEFAULT_VARIABLES[key] && !EXCLUDED_VARIABLES.includes(key)) {
            // Extraer nombre de un comentario si existe, o usar el formato capitalizado
            const nameMatch = content.match(/\/\/\s*NAME:\s*(.*)/);
            const nombre = nameMatch ? nameMatch[1].trim() : key.replace(/_/g, ' ');
            DEFAULT_VARIABLES[key] = { activa: true, ponderacion: 20, nombre };
          }
        }
      }
    }
  } catch (error) {
    console.error('[CourseVariables] Error cargando variables dinámicas:', error.message);
  }
}

// Cargar al inicio
loadDynamicVariables();


export class CourseVariables {
  /**
   * Valida un objeto de configuración de variables.
   * @param {Object} variablesObj El objeto de variables que viene del cliente.
   * @returns {Object} Un objeto estructurado y validado listo para persistencia.
   */
  static validate(variablesObj) {
    if (!variablesObj || typeof variablesObj !== 'object') {
      throw new DomainError('El formato de las variables es inválido.', 400);
    }

    const validatedVariables = {};
    let totalPonderacion = 0;

    for (const key of Object.keys(DEFAULT_VARIABLES)) {
      const inputVar = variablesObj[key];
      if (!inputVar) {
        validatedVariables[key] = { ...DEFAULT_VARIABLES[key], activa: false };
        continue;
      }

      const activa = Boolean(inputVar.activa);
      const ponderacion = Number(inputVar.ponderacion) || 0;

      if (activa) {
        if (ponderacion < 0 || ponderacion > 100) {
          throw new DomainError(`La ponderación para '${key}' debe estar entre 0 y 100.`, 400);
        }
        totalPonderacion += ponderacion;
      }

      validatedVariables[key] = {
        activa,
        ponderacion: activa ? ponderacion : 0,
        nombre: DEFAULT_VARIABLES[key].nombre
      };
    }

    const hasActiveVariables = Object.values(validatedVariables).some(v => v.activa);

    if (hasActiveVariables && Math.abs(totalPonderacion - 100) > 0.01) {
      throw new DomainError(`La suma de ponderaciones de las variables activas debe ser 100% (actual: ${totalPonderacion}%).`, 400);
    }

    return validatedVariables;
  }
}
