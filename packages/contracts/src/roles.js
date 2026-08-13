import { z } from 'zod';

export const APP_ROLES = Object.freeze({
  ADMIN: 'admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
});

export const APP_ROLE_VALUES = Object.freeze(Object.values(APP_ROLES));
export const appRoleSchema = z.enum(APP_ROLE_VALUES);
