#!/usr/bin/env python3
"""E2E startup + SIGINT with bounded file output, no PTY spinner flood."""
from pathlib import Path
import os,signal,subprocess,time,json,socket
ROOT=Path(__file__).resolve().parents[2]
NODE=str(Path.home()/'.nvm/versions/node/v22.23.2/bin/node')
OUT=ROOT/'logs'/'startup-shutdown-pipe-20261026.log'
REPORT=ROOT/'logs'/'startup-shutdown-pipe-20261026.json'
OUT.parent.mkdir(exist_ok=True)
def active(port):
 s=socket.socket()
 try:
  s.settimeout(0.5);return s.connect_ex(('127.0.0.1',port))==0
 finally:s.close()
def docker():
 return sorted(subprocess.check_output(['docker','ps','--format','{{.Names}}'],text=True,timeout=10).splitlines())
before=docker()
results=[]
for idx in range(2):
 start=time.monotonic()
 with OUT.open('ab') as out:
  out.write(('\n====== ROUND '+str(idx+1)+' ======\n').encode())
  out.flush()
  offset=OUT.stat().st_size
  env={**os.environ,'CI':'true','NON_INTERACTIVE':'true','PATH':str(Path(NODE).parent)+':'+os.environ.get('PATH','')}
  env.pop('STARTUP_MODE',None)
  p=subprocess.Popen([NODE,'apps/installer/src/preboot.js','--mode=3'],cwd=ROOT,env=env,
        stdin=subprocess.DEVNULL,stdout=out,stderr=subprocess.STDOUT,start_new_session=True)
  ready=False
  for i in range(100):
   if p.poll() is not None:break
   try:
    tail=OUT.read_bytes()[offset:][-18000:]
    if b'Startup completed' in tail:
     ready=True;break
   except OSError:pass
   time.sleep(0.6)
  if p.poll() is None:
   os.killpg(p.pid,signal.SIGINT)
   try:p.wait(timeout=35)
   except subprocess.TimeoutExpired:
    os.killpg(p.pid,signal.SIGTERM)
    try:p.wait(timeout=4)
    except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait(timeout=4)
  results.append({'round':idx+1,'startupReady':ready,'exitCode':p.returncode,
      'durationS':round(time.monotonic()-start,1),'appPorts':{str(port):active(port) for port in (3000,5173,8443)}})
  if not ready:break
  time.sleep(1)
report={'cases':results,'dockerContainersUnchanged':docker()==before}
REPORT.write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
