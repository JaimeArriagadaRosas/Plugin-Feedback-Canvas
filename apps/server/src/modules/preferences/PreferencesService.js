import PreferencesRepository from '../../repositories/PreferencesRepository.js';

export default class PreferencesService {
  constructor() {
    this.preferencesRepository = new PreferencesRepository();
  }

  async getStudentPreference(studentId) {
    const pref = await this.preferencesRepository.getPreference(studentId);
    
    // Devolver valores por defecto si no existen
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
    // Validar entradas
    const metodosValidos = ['both', 'canvas_inapp', 'email', 'none'];
    const frecuenciasValidas = ['inmediata', 'diario'];

    if (!metodosValidos.includes(metodo)) {
      throw new Error(`Método de notificación inválido: ${metodo}`);
    }

    if (!frecuenciasValidas.includes(frecuencia)) {
      throw new Error(`Frecuencia de notificación inválida: ${frecuencia}`);
    }

    const savedPref = await this.preferencesRepository.savePreference(studentId, metodo, frecuencia);
    return {
      metodo: savedPref.metodo,
      frecuencia: savedPref.frecuencia
    };
  }
}
