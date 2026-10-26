import os, subprocess, time, signal, json, socket
from pathlib import Path
root=Path('/home/jaime/proyectos/Plugin-Feedback-Canvas-feedback-cualitativo')
node=str(Path.home()/'.nvm/versions/node/v22.23.2/bin/node')
log=root/'logs/early-interrupt-live-20261026.log'
log.parent.mkdir(exist_ok=True)
env=os.environ.copy()
env.update({'CI':'true','NON_INTERACTIVE':'true','PATH':str(Path(node).parent)+':'+env.get('PATH','')})
with log.open('wb') as output:
 process=subprocess.Popen([node,'apps/installer/src/preboot.js','--mode=3'],cwd=root,
   env=env,stdin=subprocess.DEVNULL,stdout=output,stderr=subprocess.STDOUT,start_new_session=True)
 marker=b'Starting Canvas LMS stack'
 found=False
 for n in range(100):
  if process.poll() is not None:break
  try: chunk=log.read_bytes()[-12000:]
  except OSError:chunk=b''
  if marker in chunk:
   found=True
   os.killpg(process.pid,signal.SIGINT)
   break
  time.sleep(.2)
 if process.poll() is None:
  try:process.wait(timeout=20)
  except subprocess.TimeoutExpired:
   os.killpg(process.pid,signal.SIGKILL)
   process.wait(timeout=2)
 def active(port):
  s=socket.socket();s.settimeout(.3)
  try:return s.connect_ex(('127.0.0.1',port))==0
  finally:s.close()
 print(json.dumps({'signalAfterMarker':found,'exitCode':process.returncode,
   'ports':{str(p):active(p) for p in (3000,5173,8443)},
   'outputTail':log.read_text(errors='replace')[-1200:]},indent=2))
