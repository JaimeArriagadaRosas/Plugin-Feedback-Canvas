# Política de Gitleaks y secretos

## 1. Objetivo

Gitleaks analiza el árbol actual y el historial disponible. `.gitleaks.toml` usa las reglas estándar y limita excepciones a fixtures sintéticos concretos; no se permiten allowlists de directorios productivos completos.

La existencia de un escáner no reemplaza rotación, mínimos privilegios ni revisión de logs/artefactos.

## 2. Línea de base histórica

`.gitleaksignore` contiene siete fingerprints exactos de hallazgos anteriores a `fix/linux-native-setup-hardening`. La línea base no permite secretos nuevos: un cambio de commit, línea, regla o archivo vuelve a fallar.

Dos fingerprints corresponden a claves privadas antiguas presentes en commits públicos. Deben tratarse como expuestas aunque ya no existan en el árbol:

1. identificar credenciales/certificados/Developer Keys relacionados;
2. revocar o rotar;
3. comprobar que ningún entorno conserva los valores;
4. considerar reescritura coordinada del historial solo después de rotar.

Reescribir historial cambia hashes y referencias compartidas. No se ejecuta desde una rama de documentación ni sin coordinación de todos los clones/remotos.

## 3. Comprobación local

Escaneo del árbol:

```bash
docker run --rm -v "$PWD:/repo:ro" ghcr.io/gitleaks/gitleaks:v8.30.0 \
  dir /repo --config /repo/.gitleaks.toml --redact --no-banner
```

Escaneo del historial (requiere un clon con `.git`):

```bash
docker run --rm -v "$PWD:/repo:ro" ghcr.io/gitleaks/gitleaks:v8.30.0 \
  git /repo --config /repo/.gitleaks.toml --redact --no-banner
```

Una carpeta descargada como ZIP no contiene `.git` y no puede demostrar que el historial esté limpio.

## 4. Falsos positivos

Antes de ignorar:

- cambie fixtures por valores obviamente sintéticos;
- confirme que la ruta nunca llega a runtime/imagen;
- prefiera un fingerprint individual documentado;
- explique regla, archivo y razón en la revisión.

No agregue `apps/`, `config/`, `.github/` o un tipo completo de clave a una allowlist.

## 5. Incidente

Si aparece un secreto real:

1. revoque/rótelo antes de editar historial;
2. identifique logs, forks, artefactos y despliegues afectados;
3. elimínelo del árbol y sustituya el mecanismo de configuración;
4. abra un aviso privado según [SECURITY.md](SECURITY.md);
5. decida de forma coordinada si reescribe historial;
6. añada una regresión de escaneo sin incluir el valor comprometido.

Eliminar el archivo o hacer otro commit no invalida un secreto expuesto.

## 6. CI

El workflow ejecuta Gitleaks con `fetch-depth: 0` y TruffleHog. Un hallazgo nuevo bloquea el pipeline y debe corregirse; no se rebaja el escaneo para obtener un estado verde.
