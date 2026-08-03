import { describe, it, expect, vi } from 'vitest';

// Simulación de middleware de permisos para LTI
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.lti?.custom_role || 'student';
    if (allowedRoles.includes(userRole)) {
      return next();
    }
    return res.status(403).json({ error: 'Forbidden' });
  };
};

describe('Suite de Permisos (Authz)', () => {
  it('Debería permitir a un profesor (teacher) acceder a rutas protegidas de profesores', () => {
    const req = { lti: { custom_role: 'teacher' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    const middleware = requireRole(['teacher', 'admin']);
    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('Debería bloquear a un estudiante (student) acceder a rutas protegidas de profesores', () => {
    const req = { lti: { custom_role: 'student' } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const next = vi.fn();

    const middleware = requireRole(['teacher', 'admin']);
    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden' });
  });
});
