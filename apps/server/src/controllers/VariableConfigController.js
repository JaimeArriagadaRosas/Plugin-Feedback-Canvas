export default class VariableConfigController {
  constructor(variableConfigManager) {
    this.variableManager = variableConfigManager;
  }

  async getVariables(req, res, next) {
    try {
      const { courseId } = req.params;
      const variables = await this.variableManager.getCourseVariables(courseId);
      res.json({ exito: true, data: variables });
    } catch (error) {
      next(error);
    }
  }

  async saveVariables(req, res, next) {
    try {
      const { courseId } = req.params;
      const variablesObj = req.body;
      const updated = await this.variableManager.saveCourseVariables(courseId, variablesObj);
      res.json({ exito: true, mensaje: 'Variables actualizadas correctamente', data: updated });
    } catch (error) {
      next(error);
    }
  }
}
