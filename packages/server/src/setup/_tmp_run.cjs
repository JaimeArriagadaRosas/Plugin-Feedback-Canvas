const { spawn } = require('child_process');
const path = require('path');
const py = spawn('python', [path.resolve('packages/server/src/setup/verificar_entorno.py'), '3', 'false']);
py.stdout.on('data', d => process.stdout.write(d));
py.stderr.on('data', d => process.stderr.write(d));
py.on('close', c => process.exit(c));
