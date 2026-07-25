/**
 * Query Key Factory para TanStack React Query.
 * Mantiene coherencia en la invalidación de caché en toda la aplicación.
 */

export const authKeys = {
  all: ['auth'],
  me: () => ['auth', 'me'],
};

export const courseKeys = {
  all: ['courses'],
  teacher: () => ['courses', 'teacher'],
};

export const assignmentKeys = {
  all: ['assignments'],
  byCourse: (courseId) => ['assignments', courseId ? courseId.toString() : ''],
  speedgrader: (courseId) => ['assignments', courseId ? courseId.toString() : '', 'speedgrader'],
};

export const templateKeys = {
  all: ['templates'],
  detail: (id) => ['templates', id ? id.toString() : ''],
};
