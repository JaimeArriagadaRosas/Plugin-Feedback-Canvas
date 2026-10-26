# Reparación de plantillas y claves — 26/10/2026

## Hecho
- Vista previa: las variables opcionales sin dato no borran una línea completa escrita por el docente.
- Generación: frases académicas incompletas se omiten conservando otros comentarios.
- Plantillas iniciales: las tres secciones de contenido se normalizan a saltos de línea reales antes de clonarse.
- Cifrado: una instalación existente no regenera automáticamente `ENCRYPTION_KEY` ausente o inválida.
- Español: normalización de semillas localizada por nombre, dentro de su transacción y sin importar semillas inglesas.
- Inglés: las 3 plantillas existentes del profesor se restauraron en lugar de eliminarlas, preservando vínculos de asignaciones; se guardó un respaldo JSON.

## Verificaciones
- Inglés: ESLint correcto; 317 pruebas aprobadas y 1 prueba de integración opt-in omitida.
- Español: ESLint correcto; 314 pruebas aprobadas y 1 prueba de integración opt-in omitida.
- `git diff --check` limpio en ambos worktrees.

## Pendiente
- E2E de interfaz y generación de feedback Gemini real aún no comprobados tras el arreglo.
- Verificar el descifrado de API key de Gemini que antes presentó error; no se ha reemplazado ni inspeccionado el secreto.
- Los tests unitarios no prueban por sí solos la migración contra una base efímera con claves foráneas, ni equivalencia completa de funciones.
- La restauración de datos local afectó únicamente a las plantillas inglesas existentes.

## Respaldo
`~/respaldos-feedback-manual/` contiene copias de `.env`, Git bundles y respaldos de plantillas: tratar como información confidencial, nunca subir a GitHub.
