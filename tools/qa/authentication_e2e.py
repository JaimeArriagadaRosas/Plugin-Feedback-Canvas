#!/usr/bin/env python3
"""Real, windowless login/session QA against the existing *isolated* Canvas fixture."""
import argparse
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[2]
QA_ROOT=Path.home()/"qa-feedback-20261110"
CANVAS_DIR=QA_ROOT/"clean/canvas-lms-master"
WEB_CONTAINER="qa-feedback-20261110-web-1"
QA_PROJECT="qa-feedback-20261110"
SESSIONS=ROOT/"tools/diagnostics/qa_canvas_sessions_headless.mjs"
LTI=ROOT/"tools/diagnostics/qa_canvas_lti_headless.mjs"
QA_WEB_URL="http://localhost:8080"

def verified_canvas():
    if (os.getenv("QA_ALLOW_CANVAS_AUTH_TESTS")!="true" or
        os.getenv("PLUGIN_TEST_MODE")!="true" or
        os.getenv("PLUGIN_QA_NO_BROWSER")!="true"):
        raise RuntimeError("QA headless requires three explicit environment switches")
    if not CANVAS_DIR.resolve().is_dir():raise RuntimeError("Isolated Canvas directory unavailable")
    p=subprocess.run(["docker","inspect",WEB_CONTAINER,"--format","{{json .}}"],
                     capture_output=True,text=True,timeout=15,check=False)
    if p.returncode:raise RuntimeError("Isolated QA web service unavailable")
    data=json.loads(p.stdout)
    labels=data.get("Config",{}).get("Labels") or {}
    if (labels.get("com.docker.compose.project")!=QA_PROJECT or
        labels.get("com.docker.compose.service")!="web" or
        Path(labels.get("com.docker.compose.project.working_dir") or "/").resolve()!=CANVAS_DIR.resolve() or
        not data.get("State",{}).get("Running")):
        raise RuntimeError("QA web owner, folder, or runtime state cannot be verified")
    ports=data.get("NetworkSettings",{}).get("Ports",{}).get("80/tcp") or []
    if not any(x.get("HostPort")=="8080" for x in ports):
        raise RuntimeError("Expected isolated QA web HTTP 8080 binding was not found")
    return True

def synthetic_users():
    # Test accounts only, from an existing QA-only .env file. Credentials are
    # never echoed, copied to an artifact, or passed through command-line args.
    expected = {
        "admin":("QA_ADMIN_USER","admin@canvas.local","CANVAS_ADMIN_PASS"),
        "professor":("QA_PROFESSOR_USER","profesor@canvas.local","CANVAS_TEACHER_PASS"),
        "student":("QA_STUDENT_USER","estudiante1@canvas.local","CANVAS_STUDENT_PASS")
    }
    fixture=QA_ROOT/"clean/Plugin-Feedback-Canvas/.env"
    keys={value[2] for value in expected.values()}
    role_passwords={}
    if fixture.is_file() and fixture.resolve().is_relative_to(QA_ROOT.resolve()):
        for raw in fixture.read_text(encoding="utf8").splitlines():
            if "=" not in raw or raw.lstrip().startswith("#"):continue
            key,value=raw.split("=",1)
            if key.strip() in keys:
                cleaned=value.strip()
                if len(cleaned)>1 and cleaned[0]==cleaned[-1] and cleaned[0] in ["'",'"']:
                    cleaned=cleaned[1:-1]
                role_passwords[key.strip()]=cleaned
    mapping={}
    for role,(name_key,default_name,password_key) in expected.items():
        name=os.getenv(name_key,default_name)
        if not re.fullmatch(r"[\w.+-]+@canvas\.local",name):
            raise RuntimeError("Only synthetic Canvas QA test accounts are authorized")
        password=os.getenv("QA_LOGIN_PASSWORD") or role_passwords.get(password_key)
        if not password:
            raise RuntimeError("Synthetic Canvas QA credentials are unavailable; do not use real accounts")
        mapping[role]={"name":name,"password":password}
    return mapping

def run_browser(name,role,scenario,user,password,folder,script=SESSIONS,timeout=140):
    env={**os.environ,
         "QA_CANVAS_URL": QA_WEB_URL,
         "QA_LOGIN_USER": user,
         "QA_LOGIN_PASSWORD": password,
         "QA_INJECT_FK": "0",
         "QA_SCENARIO": scenario,
         "QA_SCREENSHOT_DIR": str(folder),
         "QA_EVIDENCE_PREFIX": name}
    result=subprocess.run(["node",str(script)],capture_output=True,text=True,timeout=timeout,
                          cwd=ROOT,env=env,check=False)
    checks=[line.split("QA_SESSION_CHECKS ",1)[1]
            for line in result.stdout.splitlines() if line.startswith("QA_SESSION_CHECKS ")]
    try: details=json.loads(checks[-1]) if checks else {}
    except ValueError:details={}
    conditions=details.get("checks") or {}
    passed=(result.returncode==0 and bool(conditions) and all(value is True for value in conditions.values()))
    return {"case":name,"role":role,"scenario":scenario,
            "status":"PASS" if passed else "FAIL",
            "checkCount":len(conditions),"checksPassed":sum(x is True for x in conditions.values())}

def lti_available():
    module=ROOT/"tools/diagnostics/qa_canvas_investigate.py"
    spec=importlib.util.spec_from_file_location("qa_causal_launcher_policy",module)
    instance=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(instance)
    return instance.headless_qa_owner_verified()

def run_lti(role,user,password,folder):
    env={**os.environ,
         "QA_CANVAS_URL":"https://localhost:8443",
         "QA_LOGIN_USER":user,
         "QA_LOGIN_PASSWORD":password,
         "QA_EVIDENCE_PREFIX":"compat-lti-"+role,
         "QA_SCREENSHOT_DIR":str(folder)}
    result=subprocess.run(["node",str(LTI)],capture_output=True,text=True,cwd=ROOT,
                          env=env,timeout=150,check=False)
    # The fixture script exits nonzero if either the login or the iframe failed.
    return {"case":"lti_"+role,"status":"PASS" if result.returncode==0 else "FAIL",
            "role":role,"scenario":"existing_qa_lti"}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report",required=True)
    parser.add_argument("--include-lti",action="store_true")
    args=parser.parse_args()
    path=Path(args.report).resolve()
    if not str(path).startswith(str(QA_ROOT/"artifacts")+os.sep):
        raise RuntimeError("Auth report must stay inside the isolated QA artifacts")
    verified_canvas()
    users=synthetic_users()
    screenshot=QA_ROOT/"artifacts/qa-compat-headless"
    screenshot.mkdir(exist_ok=True,parents=True)
    specs=[
        ("admin","reload"),("admin","parallel_tabs"),("admin","clear_cookies"),("admin","tampered_cookie"),
        ("professor","reload"),("professor","parallel_tabs"),("professor","clear_cookies"),
        ("professor","tampered_cookie"),("student","login_only")
    ]
    results=[]
    for role,scenario in specs:
        label="compat-"+role+"-"+scenario
        try:
            item=run_browser(label,role,scenario,users[role]["name"],users[role]["password"],screenshot)
        except subprocess.TimeoutExpired:
            item={"case":label,"role":role,"scenario":scenario,"status":"FAIL","reason":"bounded_timeout"}
        results.append(item)
        print(item["status"],label)
    if args.include_lti:
        if lti_available():
            for role in ["admin","professor"]:
                try:
                    result=run_lti(role,users[role]["name"],users[role]["password"],screenshot)
                except subprocess.TimeoutExpired:
                    result={"case":"lti_"+role,"status":"FAIL","reason":"bounded_timeout"}
                results.append(result)
                print(result["status"],result["case"])
        else:
            results.append({"case":"lti_admin_professor","status":"SKIPPED",
                            "reason":"Isolated QA Plugin Feedback HTTPS proxy is not running; cannot claim LTI verified"})
            print("SKIPPED lti_admin_professor (QA plugin proxy unavailable)")
    report={"timestamp":datetime.now(timezone.utc).isoformat(),
            "mode":"chromium_headless_only","qaProject":QA_PROJECT,
            "noNativeBrowserRequested":True,
            "results":results,
            "coverageIncomplete":any(r["status"]=="SKIPPED" for r in results)}
    path.parent.mkdir(exist_ok=True,parents=True)
    path.write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n")
    path.chmod(0o600)
    print("QA_AUTH_RESULT",sum(x["status"]=="PASS" for x in results),"/",len(results),
          "skipped",sum(x["status"]=="SKIPPED" for x in results))
    print("QA_AUTH_REPORT",path)
    return 0 if all(x["status"]!="FAIL" for x in results) else 1

if __name__=="__main__":
    try:sys.exit(main())
    except Exception as exc:
        print("QA authentication blocked:",type(exc).__name__,file=sys.stderr)
        sys.exit(3)
