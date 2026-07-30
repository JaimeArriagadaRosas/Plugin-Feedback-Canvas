import { ReportsService } from './services/reports.service.js';
import { ReportsController } from './reports.controller.js';
import { setupReportsRoutes } from './reports.routes.js';

export function initializeReportsModule(feedbackRepo) {
  const reportsService = new ReportsService(feedbackRepo);
  const reportsController = new ReportsController(reportsService);
  const reportsRouter = setupReportsRoutes(reportsController);
  
  return reportsRouter;
}
