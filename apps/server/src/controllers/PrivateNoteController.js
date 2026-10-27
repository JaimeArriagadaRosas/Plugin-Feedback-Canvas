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
        return next(new AppError('Feedback ID is required', 400));
      }

      const result = await this.privateNoteService.updateNote(id, nota_privada);
      res.json({ exito: true, mensaje: 'Private note updated', data: result });
    } catch (error) {
      next(error);
    }
  }
}
