# Matriz de compatibilidad y recuperación de Canvas

La ejecución QA se realiza solamente cuando se solicita. No se instalan tareas
permanentes ni se modifican instalaciones históricas o contenedores no propios.

## Política
- Todo escenario debe demostrar el fallo, la acción esperada y el resultado final.
- Los escenarios recuperables requieren identidad Docker verificada y autorización explícita.
- Los estados incompatibles de bases históricas se bloquean. Detectarlos no constituye
  una migración ni garantiza que una instalación antigua sea compatible.
- No abrir ventanas: usar simultáneamente PLUGIN_TEST_MODE=true y
  PLUGIN_QA_NO_BROWSER=true.
- Si solo se define una bandera, el comportamiento normal de npm start continúa intacto.
- Playwright utiliza Chromium headless.
- Los recursos y bases de pruebas son de un proyecto QA independiente y se eliminan al finalizar.

## Estados
- PASS: comportamiento previsto y ausencia de efectos inesperados.
- BLOCKED: problema no recuperable correctamente notificado, sin cambios.
- SKIPPED: escenario no ejecutable por falta de un prerrequisito real.
- FAIL: comportamiento incorrecto.

Un bloqueo correcto puede constituir un test PASS si el escenario esperaba ese bloqueo.
