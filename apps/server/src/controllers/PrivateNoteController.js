import { AppError } from '../utils/errors.js';

export default class PrivateNoteController {
  constructor(privateNoteService) {
    this.privateNoteService = privateNoteService;
  }

  async updateNote(req, res, next) {
    try {
      const { id } = req.params;
      const { nota_privada } = req.body;
      
      if (!id) {
        return next(new AppError('ID de feedback requerido', 400));
      }

      const result = await this.privateNoteService.updateNote(id, nota_privada);
      res.json({ exito: true, mensaje: 'Nota privada actualizada', data: result });
    } catch (error) {
      next(error);
    }
  }
}
