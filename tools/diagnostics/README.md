# Prueba integral de feedback sin nota

Requiere Canvas local iniciado (opción 3) y Gemini configurado en el plugin.

Ejecutar desde la raíz del worktree:

```bash
cd ~/proyectos/Plugin-Feedback-Canvas-feedback-cualitativo
node tools/diagnostics/feedback-e2e.mjs --mode=preflight --course=1 --assignment=2 --student=8 --name=Pedro 2>&1 | tee logs/feedback-pedro-preflight.log
node tools/diagnostics/feedback-e2e.mjs --mode=generate --course=1 --assignment=2 --student=8 --name=Pedro --confirm=ONE_REQUEST 2>&1 | tee logs/feedback-pedro-gemini.log
```

Preflight verifica entrega, adjunto, conversión y borrador sin llamar a Gemini. Generate realiza un intento de generación, usa el proveedor Gemini configurado y guarda o actualiza el borrador de la entrega. Nunca publica una nota ni un comentario en Canvas. No imprime tokens ni claves. La respuesta sí queda registrada en consola para evaluar su calidad. Cambiar curso, tarea, estudiante y profesor mediante `--course`, `--assignment`, `--student`, `--teacher`.

Para conservar el código de salida además de la consola: `set -o pipefail` antes de ejecutar con `tee`.
