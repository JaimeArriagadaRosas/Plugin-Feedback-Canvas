import subprocess

from constants import RAILS_RUNNER_TIMEOUT

DOCKER_RAILS_EXEC_PREFIX = [
    "docker", "compose", "exec", "-T",
    "-e", "DISABLE_SPRING=1",
    "web", "bundle", "exec", "rails", "runner",
]


def canvas_rails_runner_cmd(ruby_code):
    return [*DOCKER_RAILS_EXEC_PREFIX, ruby_code]


def run_command(cmd, shell=False, cwd=None, timeout=None):
    try:
        result = subprocess.run(
            cmd,
            shell=shell,
            cwd=cwd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout,
        )
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return False, "", f"Timeout tras {timeout}s"
    except Exception as e:
        return False, "", str(e)


def run_canvas_rails_runner(ruby_code, cwd=None, timeout=RAILS_RUNNER_TIMEOUT):
    return run_command(canvas_rails_runner_cmd(ruby_code), cwd=cwd, timeout=timeout)
