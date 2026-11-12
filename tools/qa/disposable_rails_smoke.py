#!/usr/bin/env python3
"""Isolated actual Canvas Rails bootstrap, no writes to current Canvas."""
import os, sys, json, re, secrets, subprocess, time, urllib.request, urllib.error, pathlib, datetime, socket
QA=pathlib.Path("/mnt/d/Documentos/MDL/Informatico/Plugin-Feedback-Parity-QA")
SOURCE=pathlib.Path("/home/jaime/proyectos/canvas-lms-master")
OUT=QA/"reports"/("isolated-rails-active-record-fk.json" if os.environ.get("QA_RAILS_FK_ONLY")=="true" else "isolated-rails-fresh-bootstrap.json")
owner="qa-rails-"+secrets.token_hex(5)
name=lambda suffix:owner+"-"+suffix
resources=[]
stages=[]
observations={}
def call(args,timeout=40,stdin=None):
    try:return subprocess.run(args,capture_output=True,text=True,input=stdin,timeout=timeout)
    except subprocess.TimeoutExpired:raise RuntimeError("Timeout while executing isolated QA command")
def ok(args,timeout=40):
    p=call(args,timeout)
    if p.returncode:raise RuntimeError("QA command failed: "+(" ".join(args[:4])))
    return p.stdout.strip()
def stage(n,fn):
    t=time.monotonic()
    try:
        val=fn()
        stages.append({"step":n,"status":"PASS","seconds":round(time.monotonic()-t,1)})
        print("RAILS_QA_PASS",n,flush=True)
        return val
    except Exception as e:
        stages.append({"step":n,"status":"FAIL","class":type(e).__name__,"seconds":round(time.monotonic()-t,1)})
        print("RAILS_QA_FAIL",n,type(e).__name__,flush=True)
        raise
def docker_resource(kind,suffix,*arguments):
    nm=name(suffix)
    labels=["--label","qa.canvas.disposable=true","--label","qa.canvas.owner="+owner]
    if kind=="network":
        ok(["docker","network","create",*labels,nm])
    elif kind=="volume":
        ok(["docker","volume","create",*labels,nm])
    elif kind=="container":
        ok(["docker","run","-d","--name",nm,*labels,*arguments],timeout=90)
    resources.append((kind,nm))
    return nm
def inspect(nm):
    x=json.loads(ok(["docker","inspect",nm,"--format","{{json .}}"]));return x
def confirm_qa(kind,nm):
    kindarg="volume" if kind=="volume" else "network" if kind=="network" else "container"
    val=json.loads(ok(["docker",kindarg,"inspect",nm,"--format","{{json .}}"]))
    labs=val.get("Labels") if kind in ("network","volume") else (val.get("Config") or {}).get("Labels")
    if labs.get("qa.canvas.owner")!=owner or labs.get("qa.canvas.disposable")!="true":
        raise RuntimeError("Isolated resource ownership mismatch")
def cleanup():
    errs=[]
    for kind,nm in reversed(resources):
        try:
            confirm_qa(kind,nm)
            args=["docker","rm","-f","-v",nm] if kind=="container" else ["docker","volume","rm",nm] if kind=="volume" else ["docker","network","rm",nm]
            p=call(args,timeout=65)
            if p.returncode:errs.append(kind)
        except Exception:errs.append(kind)
    return not errs
def verify_disposable_login(url, username, passcode):
    # The administrator is generated solely for this disposable database.
    # Reuse the repository's existing Playwright login test unchanged.
    root=pathlib.Path("/home/jaime/proyectos/Plugin-Feedback-Canvas")
    script=root/"tools/diagnostics/qa_canvas_sessions_headless.mjs"
    env=os.environ.copy()
    env.update({"QA_CANVAS_URL":url.split("/login/canvas")[0],
                "QA_LOGIN_USER":username, "QA_LOGIN_PASSWORD":passcode,
                "QA_SCENARIO":"login_only","QA_INJECT_FK":"0",
                "QA_SCREENSHOT_DIR":str(QA/"reports"/"screenshots"),
                "QA_EVIDENCE_PREFIX":"disposable-real-login"})
    scenarios=("login_only","reload","parallel_tabs","clear_cookies","tampered_cookie","idle")
    evidence={}
    for scenario in scenarios:
        env["QA_SCENARIO"]=scenario
        env["QA_EVIDENCE_PREFIX"]="disposable-"+scenario
        try:
            result=subprocess.run(["/home/jaime/.nvm/versions/node/v22.23.2/bin/node",str(script)],
                                  cwd=root,env=env,text=True,capture_output=True,timeout=145)
            lines=[x[len("QA_SESSION_CHECKS "):] for x in result.stdout.splitlines()
                   if x.startswith("QA_SESSION_CHECKS ")]
            checks=json.loads(lines[-1]).get("checks",{}) if lines else {}
            passed=result.returncode==0 and bool(checks) and all(checks.values())
            kinds=[label for label in
                   ("TimeoutError","TargetClosedError","BrowserType.launch","net::ERR",
                    "page.goto","page.waitForResponse","strict mode violation")
                   if label in (result.stderr+result.stdout)]
            evidence[scenario]={"passed":passed,"exitCode":result.returncode,
                                "checks":checks,"errorCategories":kinds}
        except subprocess.TimeoutExpired:
            evidence[scenario]={"passed":False,"status":"TIMEOUT"}
        print("RAILS_QA_BROWSER",scenario,"PASS" if evidence[scenario]["passed"] else "FAIL",flush=True)
    observations["sessionScenarios"]=evidence
    if not all(v.get("passed") for v in evidence.values()):
        raise RuntimeError("One or more original Canvas browser session assertions failed")
    return True

def main():
    if os.environ.get("QA_ALLOW_ISOLATED_RAILS")!="true":raise RuntimeError("Missing isolated Rails authorization")
    assert SOURCE.is_dir() and (SOURCE/"Gemfile.lock").is_file()
    assert QA.is_dir() and OUT.resolve().is_relative_to(QA.resolve())
    existing=ok(["docker","ps","-a","--format","{{.Names}}"])
    original=set(existing.splitlines())
    net=stage("create_private_network",lambda:docker_resource("network","net"))
    pgvol=stage("create_ephemeral_database_volume",lambda:docker_resource("volume","db"))
    log=stage("create_ephemeral_rails_log_volume",lambda:docker_resource("volume","log"))
    tmp=stage("create_ephemeral_rails_tmp_volume",lambda:docker_resource("volume","tmp"))
    dist=stage("create_ephemeral_generated_assets_volume",lambda:docker_resource("volume","dist"))
    def seed_disposable_styles():
        # These assets already exist in the read-only source checkout, but the
        # writable /public/dist Docker volume masks them. Copy the exact bytes
        # into the QA-only volume before Rails runs. No source changes.
        asset_source=SOURCE/"public"/"dist"/"brandable_css"
        if not (asset_source/"brandable_css_handlebars_index.json").is_file():
            raise RuntimeError("Source Canvas brandable CSS index is missing")
        confirm_qa("volume",dist)
        helper_name=name("assets")
        args=["docker","run","--rm","--network","none","--name",helper_name,
              "--label","qa.canvas.disposable=true",
              "--label","qa.canvas.owner="+owner,
              "--mount",f"type=volume,src={dist},dst=/qa/target",
              "--mount",f"type=bind,src={asset_source},dst=/qa/source,readonly",
              "--entrypoint","/bin/sh","redis:alpine","-c",
              "mkdir -p /qa/target/brandable_css && cp -a /qa/source/. /qa/target/brandable_css/"]
        ok(args,timeout=120)
        observations["brandableCssPreseededInDisposableVolume"]=True
    stage("seed_disposable_css_assets",seed_disposable_styles)
    db=stage("start_ephemeral_postgres",lambda:docker_resource("container","postgres",
        "--network",net,"--network-alias","postgres","--memory","800m",
        "--mount",f"type=volume,src={pgvol},dst=/var/lib/postgresql/data",
        "-e","POSTGRES_PASSWORD=sekret",
        "canvas-lms-master-postgres", "postgres", "-c", "fsync=off", "-c", "synchronous_commit=off", "-c", "full_page_writes=off"))
    def pg_ready():
        for i in range(75):
            x=call(["docker","exec",db,"pg_isready","-U","postgres","-d","canvas_development"],timeout=12)
            if x.returncode==0:return True
            time.sleep(1)
        raise RuntimeError("Disposable PostgreSQL did not become ready")
    stage("postgres_ready",pg_ready)
    stage("start_ephemeral_redis",lambda:docker_resource("container","redis",
        "--network",net,"--network-alias","redis","--memory","256m","--read-only",
        "--tmpfs","/data:rw,mode=1777","redis:alpine","redis-server","--save","","--appendonly","no"))
    key=secrets.token_hex(32)
    qa_admin_email='qa-admin-'+secrets.token_hex(4)+'@canvas.local'
    qa_admin_password=secrets.token_urlsafe(24)
    observations['syntheticAdminConfigured']=True
    mounts=[
        "--mount",f"type=bind,src={SOURCE},dst=/usr/src/app,readonly",
        "--mount",f"type=volume,src={log},dst=/usr/src/app/log",
        "--mount",f"type=volume,src={tmp},dst=/usr/src/app/tmp",
        "--mount",f"type=volume,src={dist},dst=/usr/src/app/public/dist",
        "--mount","type=volume,src=canvas-lms-master_canvas-bundle-gems,dst=/home/docker/.gem,readonly",
        "--mount","type=volume,src=canvas-lms-master_canvas-bundle-plugin,dst=/home/docker/.bundle,readonly",
    ]
    envargs=["-e","POSTGRES_PASSWORD=sekret","-e","ENCRYPTION_KEY="+key,
        "-e","RAILS_ENV=development","-e","RSPACK=true",
        "-e","CANVAS_LMS_ADMIN_EMAIL="+qa_admin_email,
        "-e","CANVAS_LMS_ADMIN_PASSWORD="+qa_admin_password,
        "-e","CANVAS_LMS_ACCOUNT_NAME=Disposable Canvas QA",
        "-e","CANVAS_LMS_STATS_COLLECTION=opt_out",
        "-e","CANVAS_LTI_COURSE_NAVIGATION=true"]
    cmd=["docker","run","--rm","--name",name("setup"),"--network",net,
         "--memory","3g","--cpus","2","--pids-limit","500",
         "--tmpfs","/tmp:rw,mode=1777,size=256m",
         *envargs,*mounts,"--entrypoint","/bin/bash",
         "canvas-lms-master-web","-lc",
         "bundle exec rake db:initial_setup"]
    def setup():
        p=call(cmd,timeout=480)
        observations["railsTaskReturnCode"]=p.returncode
        if p.returncode:
            lower=(p.stderr+"\n"+p.stdout).lower()
            observations["bootstrapFailureCategories"]=[c for c in
              ("readonly","permission denied","cannot write","missing","database","gem","migrate","redis","assets","error","pgvector")
              if c in lower]
            observations["bootstrapFailureLineCount"]=len(lower.splitlines())
            interesting=[]
            for line in (p.stderr+'\n'+p.stdout).splitlines():
                if any(term in line.lower() for term in ('readonly', 'read-only', 'permission denied', 'error:', 'failed', 'no such file', 'cannot write', 'migrationerror', 'fatal:', 'eacces', 'operation not permitted')):
                    clean=re.sub(r'(?i)(password|secret|token|encryption_key)\\s*[:=]\\s*[^ ,\\s]+',r'\\1=[REDACTED]',line)
                    interesting.append(clean[:260])
            observations["bootstrapErrorHints"]=interesting[-15:]
            raise RuntimeError("Isolated Rails database bootstrap failed")
        return True
    stage("canvas_rails_fresh_db_initial_setup",setup)
    if os.environ.get("QA_RAILS_FK_ONLY")=="true":
        def rails_fk():
            # Actual Rails ActiveRecord error; no production database access.
            sql=("INSERT INTO public.terms_of_services "
                 "(account_id, created_at, updated_at, workflow_state) "
                 "VALUES (999999999, NOW(), NOW(), 'active')")
            fixture_sql=("CREATE TABLE public.terms_of_services ("
                         "id BIGSERIAL PRIMARY KEY,account_id BIGINT NOT NULL,"
                         "created_at timestamp NOT NULL,updated_at timestamp NOT NULL,"
                         "workflow_state varchar NOT NULL,"
                         "CONSTRAINT fk_rails_337ba633a9 FOREIGN KEY(account_id) REFERENCES public.accounts(id))")
            ruby=("conn=ActiveRecord::Base.connection;"
                  "existing=conn.select_value(\"SELECT to_regclass('public.terms_of_services')\");"
                  "if existing.nil?;conn.execute("+json.dumps(fixture_sql)+");"
                  "puts 'QA_SYNTHETIC_TERMS_SCHEMA';end;"
                  "begin;"
                  "conn.execute("+json.dumps(sql)+");"
                  "puts 'QA_UNEXPECTED_INSERT';"
                  "rescue ActiveRecord::StatementInvalid => e;"
                  "puts 'QA_RUBY_ERROR_CLASS='+e.class.name;"
                  "puts 'QA_RUBY_CAUSE_CLASS='+e.cause.class.name if e.cause;"
                  "puts 'QA_RAILS_INVALID_FOREIGN_KEY' if e.is_a?(ActiveRecord::InvalidForeignKey);"
                  "puts 'QA_CAUSE_PG_FOREIGN_KEY' if e.cause.is_a?(PG::ForeignKeyViolation);"
                  "puts 'QA_CONSTRAINT_MATCH' if e.message.include?('fk_rails_337ba633a9');"
                  "end;"
                  "n=ActiveRecord::Base.connection.select_value("
                  "'SELECT COUNT(*) FROM public.terms_of_services WHERE account_id=999999999');"
                  "puts 'QA_NO_ORPHAN_RECORD' if n.to_i==0")
            args=["docker","run","--rm","--network",net,"--memory","3g",
                  "--tmpfs","/tmp:rw,mode=1777,size=256m",
                  *envargs,*mounts,"--entrypoint","/bin/bash",
                  "canvas-lms-master-web","-lc",
                  "bundle exec rails runner "+json.dumps(ruby)]
            p=call(args,timeout=120)
            expected=("QA_RAILS_INVALID_FOREIGN_KEY","QA_CAUSE_PG_FOREIGN_KEY",
                      "QA_CONSTRAINT_MATCH","QA_NO_ORPHAN_RECORD")
            observations["railsFkFixtureSynthetic"]=("QA_SYNTHETIC_TERMS_SCHEMA" in p.stdout)
            observations["railsFkChecks"]={x:x in p.stdout for x in expected}
            observations["railsFkDetectedErrorClasses"]=[line for line in p.stdout.splitlines()
                if line.startswith(("QA_RUBY_ERROR_CLASS=","QA_RUBY_CAUSE_CLASS="))]
            if p.returncode or not all(observations["railsFkChecks"].values()):
                observations["railsFkErrorClasses"]=[x for x in
                   ("ActiveRecord::","PG::","StatementInvalid","SyntaxError","NoMethodError")
                   if x in p.stdout+p.stderr]
                raise RuntimeError("Real Rails ActiveRecord FK exception was not confirmed")
            return True
        stage("real_active_record_fk_violation",rails_fk)
        return True
    def seed_course():
        # Only the fresh QA PostgreSQL database can receive this course.
        # This satisfies the repository's existing /courses/1 session scenarios.
        ruby=("c=Course.find_by(id:1)||Course.new(id:1);"
              "c.account=Account.default;c.name='Disposable QA Course';"
              "c.course_code='QA101';c.workflow_state='available';"
              "c.save!;puts 'DISPOSABLE_COURSE_READY' ")
        args=["docker","run","--rm","--network",net,"--memory","3g",
              "--tmpfs","/tmp:rw,mode=1777,size=256m",
              *envargs,*mounts,"--entrypoint","/bin/bash",
              "canvas-lms-master-web","-lc",
              "bundle exec rails runner "+json.dumps(ruby)]
        p=call(args,timeout=120)
        if p.returncode!=0 or "DISPOSABLE_COURSE_READY" not in p.stdout:
            observations["courseSeedErrorClasses"]=[x for x in ("ActiveRecord::","PG::","Validation","RuntimeError")
                                                    if x in p.stdout+p.stderr]
            raise RuntimeError("Synthetic course fixture could not be created")
        observations["syntheticCourseId"]=1
        return True
    stage("seed_synthetic_course",seed_course)
    # Startup only after new DB is initialized.
    web=stage("start_ephemeral_canvas_web",lambda:docker_resource("container","web",
      "--network",net,"--network-alias","web","--memory","3g","--cpus","2",
      "-p","127.0.0.1::80",
      *envargs,*mounts,"canvas-lms-master-web"))
    mapped=ok(["docker","port",web,"80/tcp"])
    match=re.search(r"127\.0\.0\.1:(\d+)",mapped)
    if not match:raise RuntimeError("Unexpected exposed host port")
    url="http://127.0.0.1:"+match.group(1)+"/login/canvas"
    def check_http():
        network_failures={}
        for i in range(45):
            try:
                with urllib.request.urlopen(url,timeout=4) as resp:
                    if resp.status<500:
                        observations["loginHttpStatus"]=resp.status
                        return True
            except urllib.error.HTTPError as e:
                observations['lastHttpStatus']=e.code
                if e.code<500:
                    observations["loginHttpStatus"]=e.code
                    return True
            except Exception as e:
                network_failures[type(e).__name__]=network_failures.get(type(e).__name__,0)+1
            time.sleep(2)
        observations['connectionFailureClasses']=network_failures
        try:
            info=json.loads(ok(['docker','inspect',web,'--format','{{json .}}']))
            observations['webContainerStatus']=info.get('State',{}).get('Status')
            observations['webOOMKilled']=info.get('State',{}).get('OOMKilled')
        except Exception:pass
        raw=[]
        for args in (['docker','logs','--tail','120',web],['docker','exec',web,'tail','-n','120','/usr/src/app/log/development.log']):
            try:
                p=call(args,timeout=15)
                raw.extend((p.stderr+'\n'+p.stdout).splitlines())
            except Exception:pass
        interesting=[]
        for line in raw:
            if any(term in line.lower() for term in ('error','exception','failed','permission','readonly','502','503','stack','listen','bundler','migration','database','connection refused','assets','fatal')):
                clean=re.sub(r'(?i)(password|secret|token|encryption_key)\\s*[:=]\\s*[^ ,\\s]+',r'\\1=[REDACTED]',line)
                interesting.append(clean[:240])
        observations['webErrorHints']=interesting[-22:]
        raise RuntimeError("Isolated Rails login route did not become ready")
    stage("real_canvas_rails_login_http_ready",check_http)
    stage("synthetic_admin_browser_login",lambda: verify_disposable_login(url,qa_admin_email,qa_admin_password))
    return True

if __name__=="__main__":
    passed=False
    initial=set()
    try:
        initial=set(ok(["docker","ps","-a","--format","{{.Names}}"]).splitlines())
        passed=main()
    except Exception as e:
        observations["blockedAt"]=stages[-1]["step"] if stages else "preflight"
        observations["failureClass"]=type(e).__name__
    finally:
        removed=cleanup()
        after=set()
        try:after=set(ok(["docker","ps","-a","--format","{{.Names}}"]).splitlines())
        except Exception:pass
        evidence={"schema":"isolated-canvas-rails-bootstrap-v1",
          "date":datetime.datetime.now(datetime.timezone.utc).isoformat(),
          "status":"PASS" if passed and removed and initial==after else "INCOMPLETE",
          "steps":stages,"notes":observations,
          "cleanedDisposableResources":removed,
          "unrelatedContainerNamesUnchanged":initial==after,
          "userCanvasRepositoryReadOnlyMounted":True,
          "userCanvasDatabaseNeverMounted":True,
          "fullLtiOauthConfirmed":False,
          "fullRailsLoginWithAccountsConfirmed":False}
        OUT.parent.mkdir(parents=True,exist_ok=True)
        OUT.write_text(json.dumps(evidence,indent=2)+"\n")
        print("RAILS_QA_RESULT",evidence["status"],"cleanup",removed,"otherContainersUnchanged",initial==after)
        print("RAILS_QA_REPORT",OUT)
        sys.exit(0 if evidence["status"]=="PASS" else 2)
