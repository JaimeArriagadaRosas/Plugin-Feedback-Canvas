export class GemCacheSecurity {
  /**
   * Retorna un script en Bash para normalizar de forma segura el caché de gems.
   * Evita alterar la propiedad o permisos a menos que el directorio pertenezca
   * al usuario actual, siguiendo un enfoque fail-closed.
   *
   * @param {string} gemRoot El directorio raíz del caché de gems.
   * @returns {string} Script bash ejecutable.
   */
  static getNormalizationScript(gemRoot = '/home/docker/.gem') {
    return `uid=$(id -u); find "${gemRoot}" -type d -perm -0002 ! -perm -1000 2>/dev/null | { fail=0; while IFS= read -r dir; do [ -z "$dir" ] && continue; owner=$(stat -c "%u" "$dir"); if [ "$owner" = "$uid" ]; then chmod o-w "$dir" || { echo "INSECURE_CHMOD_FAILED:$dir"; fail=1; }; else echo "INSECURE_UNFIXABLE:$dir"; fail=1; fi; done; if [ $fail -eq 0 ]; then remaining=$(find "${gemRoot}" -type d -perm -0002 ! -perm -1000 -print -quit 2>/dev/null); if [ $? -ne 0 ]; then echo "INSECURE_SCAN_FAILED:${gemRoot}"; fail=1; elif [ -n "$remaining" ]; then echo "INSECURE_REMAINING:$remaining"; fail=1; fi; fi; exit $fail; }`;
  }
}
