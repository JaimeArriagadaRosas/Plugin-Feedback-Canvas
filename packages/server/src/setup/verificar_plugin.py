#!/usr/bin/env python3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from constants import CANVAS_DIR, RAILS_RUNNER_TIMEOUT
from runner import run_canvas_rails_runner


def check_lti_tool():
    """
    Verifica si la herramienta LTI ya está configurada en Canvas LMS
    """
    try:
        ruby_script = (
            "tc = Lti::ToolConfiguration.where(developer_key_id: DeveloperKey.where(name: 'Plugin Feedback LTI').first&.id).first; "
            "puts (tc && tc.placements.any? { |p| p['placement'] == 'course_navigation' }) ? 'LTI_OK' : 'LTI_MISSING'"
        )
        success, stdout, _ = run_canvas_rails_runner(
            ruby_script,
            cwd=CANVAS_DIR,
            timeout=RAILS_RUNNER_TIMEOUT,
        )
        return success and "LTI_OK" in stdout
    except Exception:
        return False

if __name__ == "__main__":
    if check_lti_tool():
        sys.exit(0)
    else:
        sys.exit(1)
