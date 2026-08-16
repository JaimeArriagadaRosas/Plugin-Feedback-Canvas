import PreferencesRepository from '../../repositories/PreferencesRepository.js';

export default class PreferencesService {
  constructor() {
    this.preferencesRepository = new PreferencesRepository();
  }

  async getStudentPreference(studentId) {
    const pref = await this.preferencesRepository.getPreference(studentId);
    
    // Return default values if they don't exist
    if (!pref) {
      return {
        metodo: 'both',
        frecuencia: 'inmediata'
      };
    }
    
    return {
      metodo: pref.metodo,
      frecuencia: pref.frecuencia
    };
  }

  async saveStudentPreference(studentId, metodo, frecuencia) {
    // Validate inputs
    const metodosValidos = ['both', 'canvas_inapp', 'email', 'none'];
    const frecuenciasValidas = ['inmediata', 'diario'];

    if (!metodosValidos.includes(metodo)) {
      throw new Error(`Invalid notification method: ${metodo}`);
    }

    if (!frecuenciasValidas.includes(frecuencia)) {
      throw new Error(`Invalid notification frequency: ${frecuencia}`);
    }

    const savedPref = await this.preferencesRepository.savePreference(studentId, metodo, frecuencia);
    return {
      metodo: savedPref.metodo,
      frecuencia: savedPref.frecuencia
    };
  }
}
