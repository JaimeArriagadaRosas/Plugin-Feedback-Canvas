import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { ExcelExportService } from '../../src/modules/reports/services/exportExcel.service.js';
import { PDFExportService } from '../../src/modules/reports/services/exportPdf.service.js';

const feedback = [{
  curso_id: 1,
  nombre_curso: 'Math',
  tarea_id: 2,
  nombre_tarea: 'Algebra',
  estudiante_id: 3,
  nombre_estudiante: 'Ada',
  estado: 'APROBADO',
  calificacion_profesor: 5,
  calificacion_estudiante: 4,
  es_util: true
}];

describe('Report exporters', () => {
  it('generates operational Excel sheets without mixing logic in the public service', async () => {
    const buffer = await new ExcelExportService().generateExcel(feedback);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(expect.arrayContaining([
      'Global Metrics', 'Historical Detail', 'Audit (Critical)', 'Template History'
    ]));
  });

  it('generates a valid PDF document even when there are no operational logs', async () => {
    const buffer = await new PDFExportService().generateReport(feedback);

    expect(buffer.subarray(0, 4).toString()).toBe('%PDF');
  });
});
