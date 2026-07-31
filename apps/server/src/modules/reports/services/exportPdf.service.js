import PDFDocument from 'pdfkit';
import logger from '../../../utils/logger.js';

export class PDFExportService {
  /**
   * Genera un buffer de PDF a partir de los datos estadísticos globales.
   */
  async generateReport(data) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const buffers = [];
        
        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // ============================================
        // 1. CALCULAR MÉTRICAS EN MEMORIA
        // ============================================
        const totalFeedbacks = data.length;
        let totalAprobados = 0;
        let totalPendientes = 0;
        let totalEditados = 0;
        let totalRechazados = 0;
        
        let sumaValoracionProfesor = 0;
        let countValoracionProfesor = 0;
        let sumaValoracionEstudiante = 0;
        let countValoracionEstudiante = 0;

        const cursosMap = new Map();
        const estrellasEstudiante = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        data.forEach(row => {
          const estado = row.estado || 'PENDIENTE';
          if (estado === 'APROBADO') totalAprobados++;
          else if (estado === 'PENDIENTE') totalPendientes++;
          else if (estado === 'EDITADO') totalEditados++;
          else if (estado === 'RECHAZADO') totalRechazados++;

          if (row.calificacion_profesor) {
            sumaValoracionProfesor += Number(row.calificacion_profesor);
            countValoracionProfesor++;
          }
          if (row.calificacion_estudiante) {
            const star = Number(row.calificacion_estudiante);
            sumaValoracionEstudiante += star;
            countValoracionEstudiante++;
            if (estrellasEstudiante[star] !== undefined) estrellasEstudiante[star]++;
          }

          const cursoKey = row.curso_id;
          if (!cursosMap.has(cursoKey)) {
            cursosMap.set(cursoKey, {
              nombre: row.nombre_curso || `Curso ${cursoKey}`,
              total: 0,
              aprobados: 0
            });
          }
          const c = cursosMap.get(cursoKey);
          c.total++;
          if (estado === 'APROBADO') c.aprobados++;
        });

        const avgProfesor = countValoracionProfesor > 0 ? (sumaValoracionProfesor / countValoracionProfesor).toFixed(1) : 'N/A';
        const avgEstudiante = countValoracionEstudiante > 0 ? (sumaValoracionEstudiante / countValoracionEstudiante).toFixed(1) : 'N/A';
        const tasaAprobacionNum = totalFeedbacks > 0 ? ((totalAprobados / totalFeedbacks) * 100) : 0;
        const tasaAprobacion = tasaAprobacionNum.toFixed(1) + '%';

        // ============================================
        // 2. DISEÑO VISUAL DEL PDF
        // ============================================
        const canvasBlue = '#0374B5';
        const textColor = '#333333';
        const lightGray = '#F5F5F5';

        // Cabecera Institucional (Fondo azul, texto blanco)
        doc.rect(0, 0, doc.page.width, 100).fill(canvasBlue);
        doc.fillColor('white').fontSize(24).text('Dashboard de IA - Feedback Global', 0, 35, { align: 'center' });
        doc.fontSize(12).text(`Generado: ${new Date().toLocaleString()}`, 0, 65, { align: 'center' });
        
        doc.y = 120; // Bajar el cursor debajo de la cabecera

        // Función Helper para dibujar KPIs (Tarjetas)
        const drawKPI = (x, y, title, value) => {
          doc.rect(x, y, 110, 80).fill(lightGray).stroke('#E0E0E0');
          doc.fillColor(canvasBlue).fontSize(10).text(title, x + 5, y + 15, { width: 100, align: 'center' });
          doc.fillColor(textColor).fontSize(20).text(value, x + 5, y + 40, { width: 100, align: 'center' });
        };

        const currentY = doc.y;
        drawKPI(50, currentY, 'Total Feedbacks', String(totalFeedbacks));
        drawKPI(170, currentY, 'Tasa Aprobación', tasaAprobacion);
        drawKPI(290, currentY, 'Val. Profesores', avgProfesor !== 'N/A' ? `${avgProfesor} ⭐` : 'N/A');
        drawKPI(410, currentY, 'Val. Estudiantes', avgEstudiante !== 'N/A' ? `${avgEstudiante} ⭐` : 'N/A');

        doc.y = currentY + 110;

        // Distribución por Estados
        doc.fillColor(canvasBlue).fontSize(16).text('Distribución por Estado', 50, doc.y);
        doc.moveTo(50, doc.y + 5).lineTo(545, doc.y + 5).stroke(canvasBlue);
        doc.y += 15;
        
        const estados = [
          { name: 'APROBADOS', val: totalAprobados },
          { name: 'EDITADOS', val: totalEditados },
          { name: 'PENDIENTES', val: totalPendientes },
          { name: 'RECHAZADOS', val: totalRechazados }
        ];

        let stateY = doc.y;
        estados.forEach(est => {
          doc.fillColor(textColor).fontSize(12).text(est.name, 50, stateY);
          doc.text(String(est.val), 200, stateY);
          stateY += 20;
        });

        // Histograma Visual de Estrellas (Estudiantes)
        doc.y = stateY + 30;
        doc.fillColor(canvasBlue).fontSize(16).text('Histograma de Valoración (Estudiantes)', 50, doc.y);
        doc.moveTo(50, doc.y + 5).lineTo(545, doc.y + 5).stroke(canvasBlue);
        doc.y += 20;

        const maxStars = Math.max(...Object.values(estrellasEstudiante), 1);
        const chartY = doc.y;
        [5, 4, 3, 2, 1].forEach((star, i) => {
          const count = estrellasEstudiante[star];
          const yPos = chartY + (i * 25);
          
          doc.fillColor(textColor).fontSize(10).text(`${star} ⭐`, 50, yPos + 3);
          
          // Dibujar la barra
          const barWidth = (count / maxStars) * 300;
          if (barWidth > 0) {
            doc.rect(90, yPos, barWidth, 15).fill(canvasBlue);
          }
          doc.fillColor(textColor).text(String(count), 100 + barWidth, yPos + 3);
        });

        // Resumen por Cursos (Top 10)
        doc.y = chartY + 140;
        
        // Agregar nueva página si no queda espacio
        if (doc.y > doc.page.height - 150) {
          doc.addPage();
        }

        doc.fillColor(canvasBlue).fontSize(16).text('Resumen por Curso (Top 10)', 50, doc.y);
        doc.moveTo(50, doc.y + 5).lineTo(545, doc.y + 5).stroke(canvasBlue);
        doc.y += 20;

        // Tabla
        const cursosArray = Array.from(cursosMap.values()).sort((a, b) => b.total - a.total).slice(0, 10);
        
        doc.fillColor('#777777').fontSize(10);
        doc.text('CURSO', 50, doc.y);
        doc.text('TOTAL', 350, doc.y);
        doc.text('APROBADOS', 450, doc.y);
        doc.y += 15;

        cursosArray.forEach(c => {
          doc.fillColor(textColor).fontSize(10);
          const name = c.nombre.length > 40 ? c.nombre.substring(0, 37) + '...' : c.nombre;
          doc.text(name, 50, doc.y);
          doc.text(String(c.total), 350, doc.y);
          doc.text(String(c.aprobados), 450, doc.y);
          doc.y += 15;
          doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke('#E0E0E0');
          doc.y += 5;
        });

        doc.end();
      } catch (error) {
        logger.error('[PDFExportService] Error generando PDF:', { error });
        reject(error);
      }
    });
  }
}
