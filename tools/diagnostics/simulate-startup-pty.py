#!/usr/bin/env python3
"""PTY-only menu interrupt experiment; does not launch Canvas, Docker or backend."""
import os, pty, select, signal, subprocess, time, json, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
NODE = os.path.expanduser('~/.nvm/versions/node/v22.23.2/bin/node')
script = ("import { showMainMenu } from './apps/installer/src/orchestration/cli.js';"
          "try { const mode=await showMainMenu(); console.log('SIM_SELECTED='+mode); }"
          "catch (error) { console.log('SIM_ERROR='+error.name); process.exitCode=130; }")

def exercise(name, reply):
    master, slave = pty.openpty()
    env = {**os.environ, 'NON_INTERACTIVE': 'false'}
    env.pop('STARTUP_MODE', None)
    child = subprocess.Popen([NODE, '--input-type=module', '-e', script],
                             cwd=ROOT, env=env, stdin=slave, stdout=slave,
                             stderr=slave, start_new_session=True, close_fds=True)
    os.close(slave)
    buf=b''
    started=time.monotonic()
    sent=False
    try:
        while time.monotonic()-started<7:
            readable,_,_=select.select([master],[],[],0.1)
            if readable:
                try:
                    chunk=os.read(master,32768)
                except OSError:
                    break
                if not chunk:
                    break
                buf += chunk
                if (not sent and b'Select an option' in buf):
                    time.sleep(0.2)
                    os.write(master,reply)
                    sent=True
            if child.poll() is not None and not readable:
                break
        try:
            code=child.wait(timeout=0.5)
        except subprocess.TimeoutExpired:
            code=None
    finally:
        if child.poll() is None:
            os.killpg(child.pid, signal.SIGKILL)
            child.wait(timeout=2)
        os.close(master)
    output=buf.decode('utf-8','replace')
    return {'case':name,'inputSent':sent,'exitCode':code,
            'selected':next((line.strip() for line in output.splitlines() if 'SIM_SELECTED=' in line),None),
            'error':next((line.strip() for line in output.splitlines() if 'SIM_ERROR=' in line),None),
            'timedOut':code is None}

if __name__=='__main__':
    scenarios=[('ctrl_c_menu',b'\x03'),('blank_enter',b'\r'),('option_zero',b'0\r'),('invalid_choice',b'999\r')]
    print(json.dumps([exercise(name,key) for name,key in scenarios],indent=2))
