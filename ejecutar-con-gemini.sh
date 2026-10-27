#!/usr/bin/env bash
set -Eeuo pipefail
ROOT="$HOME/proyectos/Plugin-Feedback-Canvas-feedback-cualitativo"
[[ -d "$ROOT/apps/server" ]] || { echo "No se encuentra la carpeta del proyecto inglés: $ROOT" >&2; exit 1; }
[[ -f "$ROOT/.env" ]] || { echo "No se encuentra .env del proyecto inglés" >&2; exit 1; }
if [[ -f "$HOME/.nvm/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  source "$HOME/.nvm/nvm.sh"
fi
command -v node >/dev/null || { echo "Node.js no está disponible en WSL" >&2; exit 1; }
cd "$ROOT"
echo "5 pruebas reales Gemini; plantilla y Canvas sintéticos; feedback únicamente en RAM."
echo "El informe se creará con fecha y hora en logs/gemini-cinco-pruebas-ingles-*.md"
node tools/diagnostics/five-template-gemini.mjs
