import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { ExcelExportService } from '../../src/modules/reports/services/exportExcel.service.js';
import { PDFExportService } from '../../src/modules/reports/services/exportPdf.service.js';

const feedback = [{
  curso_id: 1,
  nombre_curso: 'Matemática',
  tarea_id: 2,
  nombre_tarea: 'Álgebra',
  estudiante_id: 3,
  nombre_estudiante: 'Ada',
  estado: 'APROBADO',
  calificacion_profesor: 5,
  calificacion_estudiante: 4,
  es_util: true
}];

describe('Exportadores de reportes', () => {
  it('genera las hojas operativas de Excel sin mezclar lógica en el servicio público', async () => {
    const buffer = await new ExcelExportService().generateExcel(feedback);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(expect.arrayContaining([
      'Métricas Globales', 'Detalle Histórico', 'Auditoría (Críticos)', 'Historial de Plantillas'
    ]));
  });

  it('genera un documento PDF válido aun cuando no hay logs operativos', async () => {
    const buffer = await new PDFExportService().generateReport(feedback);

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
