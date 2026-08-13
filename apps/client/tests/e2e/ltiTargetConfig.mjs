const LOCAL_DEFAULTS = {
  canvasUrl: 'https://localhost:8443',
  canvasUser: 'admin@example.com',
  canvasPass: 'password',
  courseId: '1'
};

const REAL_VARIABLES = [
  ['CANVAS_URL', 'canvasUrl'],
  ['CANVAS_TEST_USER', 'canvasUser'],
  ['CANVAS_TEST_PASS', 'canvasPass'],
  ['CANVAS_TEST_COURSE_ID', 'courseId']
];

export function getE2ETargetConfig(environment = process.env) {
  const isLocal = environment.E2E_TARGET !== 'real';
  if (isLocal) return getLocalConfig(environment);

  const config = {};
  const missing = [];
  for (const [variable, property] of REAL_VARIABLES) {
    if (environment[variable]?.trim()) config[property] = environment[variable].trim();
    else missing.push(variable);
  }
  if (missing.length) throw new Error(`E2E real requiere: ${missing.join(', ')}`);
  validatePublicCanvasUrl(config.canvasUrl);
  return { ...config, isLocal: false };
}

function getLocalConfig(environment) {
  return {
    canvasUrl: environment.CANVAS_URL || LOCAL_DEFAULTS.canvasUrl,
    canvasUser: environment.CANVAS_TEST_USER || LOCAL_DEFAULTS.canvasUser,
    canvasPass: environment.CANVAS_TEST_PASS || LOCAL_DEFAULTS.canvasPass,
    courseId: environment.CANVAS_TEST_COURSE_ID || LOCAL_DEFAULTS.courseId,
    isLocal: true
  };
}

function validatePublicCanvasUrl(canvasUrl) {
  let parsed;
  try {
    parsed = new URL(canvasUrl);
  } catch {
    throw new Error('CANVAS_URL debe ser una URL http(s) valida para E2E real.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || isLocalHost(parsed.hostname)) {
    throw new Error('E2E real requiere un CANVAS_URL publico; localhost y redes privadas no son validos.');
  }
}

function isLocalHost(hostname) {
  return hostname === 'localhost' || hostname.endsWith('.local') || hostname === '::1' ||
    hostname.startsWith('127.') || hostname.startsWith('10.') || hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
}
