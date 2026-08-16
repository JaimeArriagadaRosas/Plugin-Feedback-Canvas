import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/errors.js';

export default class PreferencesController {
  constructor(preferencesService) {
    this.preferencesService = preferencesService;
    this.getPreferences = asyncHandler(this.getPreferences.bind(this));
    this.updatePreferences = asyncHandler(this.updatePreferences.bind(this));
  }

  async getPreferences(req, res) {
    // The student requests their own preferences
    const studentId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId;
    
    if (!studentId) {
      throw new ApiError('Unauthenticated user or student ID unavailable', 401);
    }

    const data = await this.preferencesService.getStudentPreference(studentId);
    res.json({ exito: true, data });
  }

  async updatePreferences(req, res) {
    const studentId = req.appIdentity?.ltiUserId || req.appIdentity?.canonicalUserId;
    
    if (!studentId) {
      throw new ApiError('Unauthenticated user or student ID unavailable', 401);
    }

    const { metodo, frecuencia } = req.body;

    if (!metodo || !frecuencia) {
      throw new ApiError('Must provide method and frequency', 400);
    }

    const data = await this.preferencesService.saveStudentPreference(studentId, metodo, frecuencia);
    res.json({ exito: true, mensaje: 'Preferences updated successfully', data });
  }
}
