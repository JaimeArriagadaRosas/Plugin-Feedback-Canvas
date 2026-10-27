import { describe, expect, it, vi } from 'vitest';
import ExcelJS from 'exceljs';
import { createExcelReport } from '../../src/modules/reports/services/excelWorkbookBuilder.js';
import { createPdfReport } from '../../src/modules/reports/services/pdfReportRenderer.js';

const makeRow = (estado, overrides = {}) => ({
  id: 1, estado, curso_id: '1', nombre_curso: 'Course 1',
  estudiante_id: '7', tarea_id: '1', calificacion_estudiante: null,
  calificacion_profesor: null, es_util: null, ...overrides
});
describe('report state and rating regression', () => {
  it('counts sent feedback as completed/approved in global Excel metrics', async () => {
    const buffer = await createExcelReport({ data: [
      makeRow('ENVIADO'), makeRow('ENVIADO', { calificacion_estudiante: 5, es_util: true })
    ], auditLogs: [], migrationLogs: [], systemNotifications: [], templatesHistory: [] });
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer);
    const sheet = book.getWorksheet('Métricas Globales');
    expect(sheet.getCell('B2').value).toBe(2);
    expect(sheet.getCell('B3').value).toBe('100.0%');
    expect(sheet.getCell('B7').value).toBe(2);
  });
  it('never exports null as a star score', async () => {
    const buffer = await createExcelReport({ data: [makeRow('ENVIADO')], auditLogs: [], migrationLogs: [], systemNotifications: [], templatesHistory: [] });
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer);
    const detail = book.getWorksheet('Detalle Histórico');
    expect(detail.getCell('J2').value).toBe('N/A');
    expect(detail.getCell('K2').value).toBe('N/A');
  });
  it('generates a nonempty PDF from sent rows', async () => {
    const pdf = await createPdfReport({ data: [makeRow('ENVIADO')], auditLogs: [], migrationLogs: [] });
    expect(pdf.length).toBeGreaterThan(1000);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  });
});
