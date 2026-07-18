from pathlib import Path

PLUGIN_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent
WORKSPACE_DIR = PLUGIN_DIR.parent
CANVAS_DIR = WORKSPACE_DIR / "canvas-lms-master"
INSTALL_DIR = Path(__file__).resolve().parent

MIN_RAM_GB = 7.5
HEALTHCHECK_TIMEOUT = 120
HEALTHCHECK_INTERVAL = 5
RAILS_RUNNER_TIMEOUT = 900
DOCKER_DAEMON_TIMEOUT = 600
