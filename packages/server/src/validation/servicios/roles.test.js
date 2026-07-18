import { describe, it, expect } from 'vitest';
import {
  classifyRoles,
  resolveEffectiveRole,
  isStudentOnly,
  isLaunchAllowed,
  resolveViewRole,
  getEntryFromClaims
} from '../../utils/roles.js';

const R = {
  adminAccount: 'http://purl.imsglobal.org/vocab/lis/v2/institution/person#Administrator',
  adminMembership: 'http://purl.imsglobal.org/vocab/lis/v2/membership#Administrator',
  instructor: 'http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor',
  ta: 'http://purl.imsglobal.org/vocab/lis/v2/membership#TeachingAssistant',
  designer: 'http://purl.imsglobal.org/vocab/lis/v2/membership#ContentDeveloper',
  learner: 'http://purl.imsglobal.org/vocab/lis/v2/membership#Learner'
};

describe('roles.js  classifyRoles', () => {
  it('detecta account-admin (institution/person#Administrator)', () => {
    const c = classifyRoles([R.adminAccount, R.instructor]);
    expect(c.isAccountAdmin).toBe(true);
    expect(c.isInstructor).toBe(true);
  });

  it('detecta admin de membresa', () => {
    expect(classifyRoles([R.adminMembership]).isAccountAdmin).toBe(true);
  });

  it('detecta instructor/ta/designer/learner', () => {
    expect(classifyRoles([R.instructor]).isInstructor).toBe(true);
    expect(classifyRoles([R.ta]).isTA).toBe(true);
    expect(classifyRoles([R.designer]).isDesigner).toBe(true);
    expect(classifyRoles([R.learner]).isLearner).toBe(true);
  });

  it('acepta roles como string suelto', () => {
    expect(classifyRoles(R.learner).isLearner).toBe(true);
  });
});

describe('roles.js  resolveEffectiveRole', () => {
  it('account-admin gana sobre instructor (corrige crossover admindocente)', () => {
    expect(resolveEffectiveRole(classifyRoles([R.adminAccount, R.instructor]))).toBe('admin');
  });

  it('instructor puro es teacher', () => {
    expect(resolveEffectiveRole(classifyRoles([R.instructor]))).toBe('teacher');
  });

  it('learner puro es student', () => {
    expect(resolveEffectiveRole(classifyRoles([R.learner]))).toBe('student');
  });

  it('TA y Designer resuelven como teacher', () => {
    expect(resolveEffectiveRole(classifyRoles([R.ta]))).toBe('teacher');
    expect(resolveEffectiveRole(classifyRoles([R.designer]))).toBe('teacher');
  });

  it('sin roles reconocidos es unknown', () => {
    expect(resolveEffectiveRole(classifyRoles(['http://example.com/otro']))).toBe('unknown');
  });
});

describe('roles.js  isStudentOnly / isLaunchAllowed', () => {
  it('estudiante puro es student-only y no puede lanzar', () => {
    const c = classifyRoles([R.learner]);
    expect(isStudentOnly(c)).toBe(true);
    expect(isLaunchAllowed({ 'https://purl.imsglobal.org/spec/lti/claim/roles': [R.learner] })).toBe(false);
  });

  it('docente puede lanzar', () => {
    expect(isLaunchAllowed({ 'https://purl.imsglobal.org/spec/lti/claim/roles': [R.instructor] })).toBe(true);
  });

  it('account-admin en contexto de curso puede lanzar', () => {
    expect(isLaunchAllowed({ 'https://purl.imsglobal.org/spec/lti/claim/roles': [R.adminAccount, R.instructor] })).toBe(true);
  });

  it('token sin claims de roles se permite (lo resuelve el flujo real)', () => {
    expect(isLaunchAllowed({})).toBe(true);
  });
});

describe('roles.js  resolveViewRole', () => {
  it('entry=admin fuerza rol admin aunque venga de curso', () => {
    expect(resolveViewRole({
      isLocalSession: false,
      roles: [R.instructor],
      entry: 'admin',
      courseId: '123'
    })).toBe('admin');
  });

  it('account-admin en curso resuelve admin (no teacher)', () => {
    expect(resolveViewRole({
      isLocalSession: false,
      roles: [R.adminAccount, R.instructor],
      entry: null,
      courseId: '123'
    })).toBe('admin');
  });

  it('modo local respeta el rol explcito', () => {
    expect(resolveViewRole({
      isLocalSession: true,
      localRole: 'teacher',
      roles: [],
      entry: null,
      courseId: null
    })).toBe('teacher');
  });

  it('claim desconocido => estudiante (privilegio mínimo), con o sin contexto', () => {
    // Defensa en profundidad: un claim de rol no reconocido jamás debe elevar
    // privilegios a teacher (riesgo de escalada). Siempre es student.
    expect(resolveViewRole({ isLocalSession: false, roles: ['x'], entry: null, courseId: '1' })).toBe('student');
    expect(resolveViewRole({ isLocalSession: false, roles: ['x'], entry: null, courseId: null })).toBe('student');
  });
});

describe('roles.js  getEntryFromClaims', () => {
  it('lee el custom param unida_entry', () => {
    const decoded = { 'https://purl.imsglobal.org/spec/lti/claim/custom': { unida_entry: 'admin' } };
    expect(getEntryFromClaims(decoded)).toBe('admin');
  });

  it('devuelve null si no hay custom', () => {
    expect(getEntryFromClaims({})).toBe(null);
  });
});
