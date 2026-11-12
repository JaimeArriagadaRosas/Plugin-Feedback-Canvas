#!/usr/bin/env python3
"""Safe English backend smoke: disposable DB, isolated listener, no Canvas writes."""
import os,subprocess,sys,secrets,socket,hashlib,json,time,signal,ssl,urllib.request,urllib.error
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path("/home/jaime/proyectos/Plugin-Feedback-Canvas")
QA=Path("/mnt/d/Documentos/MDL/Informatico/Plugin-Feedback-Parity-QA")
REPORT=QA/"reports"/"english-disposable-backend.json"
owner="qa-english-backend-"+secrets.token_hex(5)
db=owner+"-db"
volume=owner+"-volume"
created=[]
proc=None
checks={}
failure=None
def run(argv,timeout=30):
 try:return subprocess.run(argv,capture_output=True,text=True,timeout=timeout)
 except subprocess.TimeoutExpired:raise RuntimeError("QA command timed out")
def guard(ok,what):
 if not ok:raise RuntimeError("QA safety condition failed: "+what)
def port_free():
 with socket.socket(socket.AF_INET,socket.SOCK_STREAM) as s:
  s.bind(("127.0.0.1",0))
  return s.getsockname()[1]
def hashes():
 return {n:hashlib.sha256((ROOT/"apps/server/certs"/n).read_bytes()).hexdigest()
         for n in ("localhost.pem","localhost-key.pem","session_keys.json")}
def inspect_ok(kind,name):
 r=run(["docker",kind,"inspect",name,"--format","{{json .}}"])
 if r.returncode:return False
 data=json.loads(r.stdout)
 labels=data.get("Labels") if kind=="volume" else (data.get("Config") or {}).get("Labels")
 return labels.get("qa.plugin.owner")==owner and labels.get("qa.plugin.disposable")=="true"
def remove_all():
 global proc
 if proc is not None and proc.poll() is None:
  try:os.killpg(proc.pid,signal.SIGTERM)
  except ProcessLookupError:pass
  try:proc.wait(timeout=12)
  except subprocess.TimeoutExpired:
   try:os.killpg(proc.pid,signal.SIGKILL)
   except ProcessLookupError:pass
   proc.wait(timeout=5)
 good=True
 for kind,name in reversed(created):
  if not inspect_ok(kind,name):
   good=False;continue
  args=["docker","rm","-f",name] if kind=="container" else ["docker","volume","rm",name]
  good=run(args,timeout=35).returncode==0 and good
 return good
def health(port):
 ctx=ssl._create_unverified_context()
 base="https://127.0.0.1:"+str(port)
 try:
  with urllib.request.urlopen(base+"/health",timeout=3,context=ctx) as r:
   hs=r.status
  with urllib.request.urlopen(base+"/api/lti/jwks",timeout=3,context=ctx) as r:
   jwks=json.loads(r.read(100000));js=r.status
  return hs==200 and js==200 and bool(jwks.get("keys"))
 except Exception:return False
def main():
 global proc
 guard(os.getenv("QA_ALLOW_ISOLATED_PLUGIN_BACKEND")=="true","explicit authorization")
 guard(ROOT.is_dir() and QA.is_dir(),"expected workspace")
 guard(run(["git","-C",str(ROOT),"branch","--show-current"]).stdout.strip()=="english-version","English-only")
 before=run(["git","-C",str(ROOT),"status","--porcelain"]).stdout.strip()
 guard(before=="","clean working tree required")
 certs=hashes()
 base=set(run(["docker","ps","-a","--format","{{.Names}}"]).stdout.splitlines())
 checks["repositoryBranchCorrect"]=True
 checks["sourceInitiallyClean"]=True
 dbpass=secrets.token_urlsafe(28)
 dbname="qa_english_"+secrets.token_hex(4)
 dbport=port_free()
 backend_port=port_free()
 guard(dbport!=backend_port and dbport!=5432 and backend_port not in (3000,8080),"isolated ports")
 labels=["--label","qa.plugin.disposable=true","--label","qa.plugin.owner="+owner]
 v=run(["docker","volume","create",*labels,volume])
 guard(v.returncode==0,"temporary volume creation")
 created.append(("volume",volume))
 d=run(["docker","run","-d","--name",db,*labels,
     "--memory","650m","-e","POSTGRES_USER=postgres",
     "-e","POSTGRES_PASSWORD="+dbpass,"-e","POSTGRES_DB="+dbname,
     "-p",f"127.0.0.1:{dbport}:5432",
     "--mount",f"type=volume,src={volume},dst=/var/lib/postgresql/data",
     "postgres:15-alpine"],timeout=60)
 guard(d.returncode==0,"temporary PostgreSQL start")
 created.append(("container",db))
 ready=False
 for _ in range(45):
  if run(["docker","exec",db,"pg_isready","-U","postgres","-d",dbname],timeout=8).returncode==0:
   ready=True;break
  time.sleep(1)
 guard(ready,"temporary PostgreSQL readiness")
 checks["postgresqlReady"]=True
 safe={k:os.environ[k] for k in ("PATH","HOME","USER","LANG","TZ","TERM") if k in os.environ}
 safe["PATH"]="/home/jaime/.nvm/versions/node/v22.23.2/bin:"+safe.get("PATH","")
 safe.update({
  "DB_HOST":"127.0.0.1","DB_PORT":str(dbport),"DB_USER":"postgres",
  "DB_PASSWORD":dbpass,"DB_NAME":dbname,
  "PORT":str(backend_port),"NODE_ENV":"test","STARTUP_MODE":"3",
  "PLUGIN_TEST_MODE":"true","PLUGIN_QA_NO_BROWSER":"true",
  "LOG_TO_FILE":"false","LOG_LEVEL":"warn","AUTO_MIGRATE":"true",
  "HTTPS":"true","USE_LOCAL_DATA":"false","VITE_USE_LOCAL_DATA":"false",
  "FRONTEND_URL":"https://127.0.0.1:"+str(backend_port),
  "CANVAS_BASE_URL":"https://localhost:8443",
  "CANVAS_ISSUER":"https://localhost:8443",
  "CANVAS_ACCESS_TOKEN":"","CANVAS_CLIENT_SECRET":"",
  "CANVAS_CLIENT_ID":"0","LTI_CLIENT_ID":"0",
  "DEV_TOKEN_SECRET":secrets.token_urlsafe(48),
  "WEBHOOK_SECRET":secrets.token_urlsafe(48),
  "ENCRYPTION_KEY":secrets.token_hex(32),
  "LTI_REDIRECT_URI":"https://127.0.0.1:"+str(backend_port)+"/api/lti/callback"
 })
 guard(not socket_bound(backend_port),"QA listener occupied")
 log=QA/"reports"/"backend-qa-classifications.log"
 # Keep output out of the repository. It may contain tokens; never publish it.
 with log.open("wb") as stream:
  proc=subprocess.Popen(["/home/jaime/.nvm/versions/node/v22.23.2/bin/node",
                          "apps/server/src/server.js"],cwd=ROOT,env=safe,
                         stdin=subprocess.DEVNULL,stdout=stream,stderr=subprocess.STDOUT,
                         start_new_session=True)
  passed=False
  for _ in range(65):
   if proc.poll() is not None:break
   if health(backend_port):passed=True;break
   time.sleep(2)
 checks["backendHttpsHealthAndJwks"]=passed
 checks["backendProcessRemainedRunning"]=proc.poll() is None
 if not passed:
  data=log.read_text(errors="replace")
  checks["backendErrorCategories"]=[x for x in ("TypeError","ReferenceError","ERR_INVALID_URL",
      "missing","Cannot find module","database","certificate","EADDRINUSE","invalid",
      "Migration","connect ECONNREFUSED") if x.lower() in data.lower()]
 guard(passed,"backend HTTPS/JWKS readiness")
 return base,certs
def socket_bound(port):
 with socket.socket() as s:
  s.settimeout(.3)
  return s.connect_ex(("127.0.0.1",port))==0
if __name__=="__main__":
 original=set()
 initial_hashes=None
 success=False
 try:
  original=set(run(["docker","ps","-a","--format","{{.Names}}"]).stdout.splitlines())
  initial_hashes=hashes()
  main()
  success=True
 except Exception as exc:
  failure=type(exc).__name__
 finally:
  cleaned=remove_all()
  remaining=set(run(["docker","ps","-a","--format","{{.Names}}"]).stdout.splitlines())
  checks["cleanupConfirmed"]=cleaned
  checks["unrelatedContainersUnchanged"]=original==remaining
  checks["sourceCertsUnchanged"]=initial_hashes==hashes() if initial_hashes else False
  checks["gitWorkingTreeStillClean"]=run(["git","-C",str(ROOT),"status","--porcelain"]).stdout.strip()==""
  success=success and all(checks[k] for k in
      ("cleanupConfirmed","unrelatedContainersUnchanged","sourceCertsUnchanged","gitWorkingTreeStillClean"))
  result={"generatedAtUtc":datetime.now(timezone.utc).isoformat(),
          "status":"PASS" if success else "INCOMPLETE",
          "checks":checks,"failureClass":failure,
          "fullLtiLaunchConfirmed":False,
          "sourceCommit":run(["git","-C",str(ROOT),"rev-parse","HEAD"]).stdout.strip()}
  REPORT.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
  print("QA_ENGLISH_BACKEND",result["status"],"health",checks.get("backendHttpsHealthAndJwks"),
        "cleanup",cleaned,"sourceClean",checks["gitWorkingTreeStillClean"],flush=True)
  print("QA_BACKEND_REPORT",REPORT,flush=True)
  sys.exit(0 if success else 2)
