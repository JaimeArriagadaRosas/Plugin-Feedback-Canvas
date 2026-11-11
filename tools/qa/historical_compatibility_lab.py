#!/usr/bin/env python3
"""Historical compatibility lab. Source repositories and Docker volumes are READ ONLY.

All code, tests and documentation live in the chosen Spanish-main clone.
Any extracted source, executable or PostgreSQL data is an ephemeral QA copy.
"""
from __future__ import annotations
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tarfile
import tempfile
import time
from datetime import datetime, timezone

HOME = Path.home()
ROOT = Path(__file__).resolve().parents[2]
QA_ROOT = HOME / "qa-feedback-20261110" / "artifacts" / "historical-compat"
HIST = {
    "august-main": HOME / "proyectos/Plugin-Feedback-Canvas-main-video",
    "october-validation": HOME / "proyectos/Plugin-Feedback-Canvas-validacion-limpia",
    "october-lint": HOME / "proyectos/Plugin-Feedback-Canvas-main-lint",
    "october-original": HOME / "proyectos/Plugin-Feedback-Canvas",
}
PG_SOURCES = {
    "august-canvas-db": ("canvas-lms-main-video-clean-postgres-1",
                         HOME / "proyectos/canvas-lms-main-video-clean",
                         "canvas-lms-main-video-clean"),
    "october-canvas-db": ("canvas-lms-master-postgres-1",
                          HOME / "proyectos/canvas-lms-master",
                          "canvas-lms-master"),
    "october-alternate-db": ("plugin-feedback-canvas-postgres-1",
                             HOME / "proyectos/canvas-lms-master",
                             "plugin-feedback-canvas"),
}
PREFIX = "qa-historical-"

class QABlocked(RuntimeError):
    pass

def command(argv, *, timeout=60, stdin=None, cwd=None, env=None):
    try:
        return subprocess.run(argv, input=stdin, capture_output=True, timeout=timeout,
                              cwd=cwd, env=env, check=False)
    except subprocess.TimeoutExpired as exc:
        raise QABlocked("Bounded command timeout") from exc

def text(result):
    return result.stdout.decode(errors="replace").strip()

def require_qa():
    for key in ("QA_ALLOW_HISTORICAL_COMPAT", "PLUGIN_TEST_MODE", "PLUGIN_QA_NO_BROWSER"):
        if os.environ.get(key) != "true":
            raise QABlocked("Explicit isolated QA + headless authorization required")
    if ROOT != (HOME / "proyectos/Plugin-Feedback-Canvas-feedback-cualitativo").resolve():
        raise QABlocked("Only the selected unified clone can host this program")
    QA_ROOT.mkdir(parents=True, exist_ok=True, mode=0o700)
    if QA_ROOT.is_symlink() or not QA_ROOT.resolve().is_relative_to(HOME / "qa-feedback-20261110"):
        raise QABlocked("Invalid QA artifact directory")

def sha(name):
    return hashlib.sha256(name.encode()).hexdigest()[:12]

def git_readonly(repo, *args):
    if not (repo / ".git").exists():
        raise QABlocked("Historical source is not a standalone Git clone")
    result = command(["git", "--no-optional-locks", "-C", str(repo), *args], timeout=35)
    if result.returncode:
        raise QABlocked("Read-only Git metadata unavailable")
    return text(result)

def source_metadata(key):
    root = HIST[key]
    if not root.resolve().is_relative_to(HOME / "proyectos") or root.resolve() == ROOT:
        raise QABlocked("Historical repository directory not authorized")
    return {"name":key, "sha":git_readonly(root, "rev-parse", "HEAD"),
            "branch":git_readonly(root, "branch", "--show-current"),
            "commitDate":git_readonly(root, "show", "-s", "--format=%cs", "HEAD"),
            "lockfile":(root / "package-lock.json").exists(),
            "hasPackage":(root / "package.json").is_file()}

def inspected_pg(key):
    name, workdir, project = PG_SOURCES[key]
    result=command(["docker","inspect",name,"--format","{{json .}}"],timeout=25)
    if result.returncode:raise QABlocked("Historical container could not be inspected")
    obj=json.loads(text(result))
    labels=obj.get("Config",{}).get("Labels") or {}
    if (labels.get("com.docker.compose.project") != project or
        labels.get("com.docker.compose.service") != "postgres" or
        Path(labels.get("com.docker.compose.project.working_dir") or "/").resolve() != workdir.resolve() or
        obj.get("State",{}).get("Running") or obj.get("State",{}).get("Status") != "exited"):
        raise QABlocked("Historical container identity mismatch or it is running")
    matches=[m.get("Name") for m in obj.get("Mounts",[])
             if m.get("Type")=="volume" and m.get("Destination")=="/var/lib/postgresql/data"]
    if len(matches)!=1 or not matches[0]:
        raise QABlocked("Historical PostgreSQL volume is ambiguous")
    return {"container":name, "project":project, "volume":matches[0],
            "image":obj["Config"]["Image"], "created":obj["Created"][:19]}

def pg_major(meta):
    result=command(["docker","run","--rm","--network","none","--read-only",
        "--mount",f"type=volume,src={meta['volume']},dst=/historical,readonly",
        "--entrypoint","cat","postgres:15-alpine","/historical/PG_VERSION"],timeout=60)
    version=text(result)
    if result.returncode or not re.fullmatch(r"1[0-9]",version):
        raise QABlocked("Unknown historical PostgreSQL major version")
    return version

def inventory():
    sources=[source_metadata(k) for k in HIST]
    postgres=[]
    for key in PG_SOURCES:
        try:
            meta=inspected_pg(key)
            postgres.append({"name":key,"dockerProject":meta["project"],
                             "created":meta["created"],"status":"stopped",
                             "volumeFingerprint":sha(meta["volume"]),"pgMajor":pg_major(meta)})
        except QABlocked as exc:
            postgres.append({"name":key,"available":False,"reason":str(exc)})
    return {"sources":sources, "historicalPostgres":postgres,
            "sourceModificationPermitted":False,"legacyVolumeModificationPermitted":False}

def safe_archive(blob, target):
    root=target.resolve()
    count=0
    with tarfile.open(fileobj=io.BytesIO(blob),mode="r:") as archive:
        for member in archive:
            name=Path(member.name)
            if (name.is_absolute() or ".." in name.parts or not name.parts or
                name.parts[0]==".git"):
                raise QABlocked("Unsafe archive entry")
            if any(component in {"node_modules",".npmrc"} or component.startswith(".env")
                   for component in name.parts):
                continue
            if member.issym() or member.islnk() or member.isdev():
                raise QABlocked("Historical source contains a link/device; refusing extraction")
            dest=(root/name).resolve()
            if not dest.is_relative_to(root):raise QABlocked("Archive escapes QA directory")
            if member.isdir():dest.mkdir(parents=True,exist_ok=True)
            elif member.isfile():
                stream=archive.extractfile(member)
                if stream is None:raise QABlocked("Archive entry cannot be read")
                dest.parent.mkdir(parents=True,exist_ok=True)
                dest.write_bytes(stream.read())
                dest.chmod(0o600)
                count+=1
    return count

def build_source(key):
    if key not in HIST:raise QABlocked("Not an approved historical source")
    source=source_metadata(key)
    with tempfile.TemporaryDirectory(prefix=PREFIX+key+"-",dir=QA_ROOT) as work:
        root=Path(work)
        original=HIST[key]
        archive=command(["git","--no-optional-locks","-C",str(original),
                         "archive","--format=tar",source["sha"]],timeout=70)
        if archive.returncode:raise QABlocked("Cannot archive historical source")
        count=safe_archive(archive.stdout,root)
        if not (root/"package-lock.json").exists() or not (root/"package.json").exists():
            return {"name":key,"status":"SKIPPED","reason":"Missing locked npm manifest"}
        package=json.loads((root/"package.json").read_text())
        if "build" not in package.get("scripts",{}):
            return {"name":key,"status":"SKIPPED","reason":"No build script"}
        allowed_env=("PATH","HOME","USER","LANG","SHELL","TMPDIR","XDG_CACHE_HOME","NPM_CONFIG_CACHE")
        env={key:os.environ[key] for key in allowed_env if key in os.environ}
        env.update({"CI":"true","PLUGIN_TEST_MODE":"true",
             "PLUGIN_QA_NO_BROWSER":"true","BROWSER":"none",
             "npm_config_offline":"true","npm_config_ignore_scripts":"true",
             "npm_config_audit":"false","npm_config_fund":"false"})
        install=command(["npm","ci","--offline","--ignore-scripts","--no-audit","--no-fund"],
                        timeout=240,cwd=root,env=env)
        install_method="offline_npm_ci"
        if install.returncode:
            # The original clone already contains dependencies. Copy them,
            # without hardlinks or symlinks back to that clone: Vite may write
            # caches inside node_modules. The historical tree stays immutable.
            source_modules=original/"node_modules"
            if not source_modules.is_dir() or source_modules.is_symlink():
                return {"name":key,"status":"BLOCKED","stage":"npm_ci_offline",
                        "reason":"Dependencies unavailable or lockfile incompatible",
                        "archivedFiles":count}
            modules_target=root/"node_modules"
            if modules_target.exists():
                import shutil
                shutil.rmtree(modules_target)
            copied=command(["cp","-a","--reflink=auto",str(source_modules),str(modules_target)],
                           timeout=300)
            if copied.returncode:
                return {"name":key,"status":"BLOCKED","stage":"isolated_dependencies_copy",
                        "reason":"Could not copy installed modules into QA workspace",
                        "archivedFiles":count}
            install_method="independent_copy_of_historical_node_modules"
        built=command(["npm","run","build"],timeout=160,cwd=root,env=env)
        return {"name":key,"status":"PASS" if built.returncode==0 else "FAIL",
                "stage":"build","archivedFiles":count,
                "dependencyMethod":install_method,
                "note":"Only temporary Git archive and independent dependency copy were used"}

def check_source_syntax(key):
    if key not in HIST:
        raise QABlocked("Not an approved historical source")
    meta=source_metadata(key)
    with tempfile.TemporaryDirectory(prefix=PREFIX+"syntax-"+key+"-",dir=QA_ROOT) as temp:
        root=Path(temp)
        archive=command(["git","--no-optional-locks","-C",str(HIST[key]),
                         "archive","--format=tar",meta["sha"]],timeout=70)
        if archive.returncode:raise QABlocked("Cannot archive historical source")
        archived=safe_archive(archive.stdout,root)
        scripts=[]
        for directory in ("apps/installer/src","apps/server/src","packages/plugin-database/src"):
            path=root/directory
            if path.exists():
                scripts += list(path.rglob("*.js"))
        if not scripts:
            return {"name":key,"status":"SKIPPED","reason":"No inspectable JavaScript source"}
        failed=[]
        for path in scripts:
            result=command(["node","--check",str(path)],timeout=12,cwd=root,
                           env={**os.environ,"CI":"true","PLUGIN_TEST_MODE":"true",
                                "PLUGIN_QA_NO_BROWSER":"true","BROWSER":"none"})
            if result.returncode:
                failed.append(str(path.relative_to(root)))
        return {"name":key,"status":"PASS" if not failed else "FAIL",
                "stage":"syntax","filesChecked":len(scripts),
                "syntaxFailures":failed[:12],"archivedFiles":archived,
                "note":"Syntax check does not import, execute, or install historical code"}


def matching_image(meta,major):
    image=meta["image"]
    result=command(["docker","run","--rm","--network","none","--read-only",
                    "--entrypoint","postgres",image,"--version"],timeout=40)
    match=re.search(r"PostgreSQL\)\s+(\d+)",text(result))
    if result.returncode or not match or match.group(1)!=major:
        raise QABlocked("Historical container image PostgreSQL binary does not match PG_VERSION")
    return image

def docker_metadata(kind,name):
    p=command(["docker",kind,"inspect",name,"--format","{{json .}}"],timeout=20)
    if p.returncode:raise QABlocked("QA resource unavailable")
    return json.loads(text(p))

def qa_client_id():
    fixture=HOME/"qa-feedback-20261110/clean/Plugin-Feedback-Canvas/.env"
    if not fixture.is_file() or not fixture.resolve().is_relative_to(HOME/"qa-feedback-20261110"):
        return None
    for line in fixture.read_text(encoding="utf8").splitlines():
        if line.startswith("LTI_CLIENT_ID="):
            client=line.partition("=")[2].strip().strip("'\\\"")
            return client if re.fullmatch(r"[0-9]{1,18}",client) else None
    return None

def inspect_lti_catalog(db_container,client_id=None):
    if client_id is not None and not re.fullmatch(r"[0-9]{1,18}",client_id):
        raise QABlocked("Unexpected QA LTI client format")
    client_compare=(f"developer_key_id={client_id}" if client_id is not None else "FALSE")
    sql=f"""BEGIN TRANSACTION READ ONLY;
SELECT json_build_object(
 'tools',COUNT(*),
 'publicTools',COUNT(*) FILTER (WHERE workflow_state='public'),
 'toolsWithDeveloperKey',COUNT(*) FILTER (WHERE developer_key_id IS NOT NULL),
 'toolsForLocalQaBackend',COUNT(*) FILTER (WHERE url LIKE 'https://localhost:3000%'),
 'toolsMatchingCurrentQaClient',COUNT(*) FILTER (WHERE {client_compare})
) FROM public.context_external_tools;
ROLLBACK;
"""
    proc=command(["docker","exec","-i","-e","PGHOST=/tmp",
        "-e","PGOPTIONS=-c default_transaction_read_only=on",
        db_container,"psql","-X","-q","-A","-t",
        "-v","ON_ERROR_STOP=1","-U","postgres","-d","canvas_development"],
        stdin=sql.encode(),timeout=25)
    if proc.returncode:
        return {"status":"CATALOG_UNAVAILABLE"}
    try:
        outcome=json.loads(text(proc).splitlines()[-1])
    except (ValueError,IndexError):
        return {"status":"CATALOG_UNAVAILABLE"}
    if set(outcome)!={"tools","publicTools","toolsWithDeveloperKey","toolsForLocalQaBackend","toolsMatchingCurrentQaClient"}:
        return {"status":"CATALOG_UNAVAILABLE"}
    if any(not isinstance(n,int) or n<0 for n in outcome.values()):
        return {"status":"CATALOG_UNAVAILABLE"}
    outcome["clientIdProvided"]=client_id is not None
    outcome["status"]="CONFIG_CANDIDATE" if (
        outcome["publicTools"]>0 and
        outcome["toolsForLocalQaBackend"]>0 and
        outcome["toolsMatchingCurrentQaClient"]>0) else "REGISTRATION_REVIEW"
    # Never imply a successful launch from registration metadata alone.
    outcome["actualLtiLaunchConfirmed"]=False
    return outcome

def clone_pg(key):
    if key not in PG_SOURCES:raise QABlocked("Unknown historical PostgreSQL source")
    old=inspected_pg(key)
    major=pg_major(old)
    image=matching_image(old,major)
    token=secrets.token_hex(6)
    owned=PREFIX+token
    clone_volume=owned+"-data"
    clone_container=owned+"-postgres"
    volume_created=False
    container_created=False
    report={"name":key,"status":"BLOCKED","pgMajor":major,
            "originalContainerState":"exited","originalVolumeFingerprint":sha(old["volume"]),
            "originalModified":False,"copyTemporary":True}
    try:
        made=command(["docker","volume","create","--label","qa.historical.disposable=true",
                     "--label",f"qa.historical.owner={owned}",clone_volume],timeout=25)
        if made.returncode or text(made)!=clone_volume:
            raise QABlocked("Could not create an owned QA volume")
        volume_created=True
        # Read-only source mount is enforced by Docker. No original services are started.
        copy=command(["docker","run","--rm","--network","none",
            "--mount",f"type=volume,src={old['volume']},dst=/source,readonly",
            "--mount",f"type=volume,src={clone_volume},dst=/copy",
            "--entrypoint","sh",image,"-ec",
            "cp -a /source/. /copy/; test \"$(cat /copy/PG_VERSION)\" = '"+major+"'"],
            timeout=180)
        if copy.returncode:raise QABlocked("Historical volume copy failed integrity preflight")
        run=command(["docker","run","-d","--name",clone_container,
            "--label","qa.historical.disposable=true",
            "--label",f"qa.historical.owner={owned}",
            "--network","none","--read-only","--tmpfs","/tmp:rw,mode=1777",
            "--mount",f"type=volume,src={clone_volume},dst=/var/lib/postgresql/data",
            "--user","postgres","--entrypoint","postgres",image,
            "-D","/var/lib/postgresql/data",
            "-c","listen_addresses=",
            "-c","unix_socket_directories=/tmp"],timeout=40)
        if run.returncode:raise QABlocked("Could not start isolated PostgreSQL copy")
        container_created=True
        deadline=time.monotonic()+45
        while time.monotonic()<deadline:
            ready=command(["docker","exec",clone_container,"pg_isready","-h","/tmp","-U","postgres"],
                          timeout=8)
            if ready.returncode==0:break
            time.sleep(1)
        else:
            raise QABlocked("Historical database copy failed to become ready")
        sql="""BEGIN TRANSACTION READ ONLY;
SELECT current_database(),(SELECT count(*) FROM pg_database WHERE datname='canvas_development');
ROLLBACK;
"""
        check=command(["docker","exec","-i","-e","PGHOST=/tmp",
            "-e","PGOPTIONS=-c default_transaction_read_only=on",
            clone_container,"psql","-X","-q","-A","-t",
            "-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],stdin=sql.encode(),timeout=25)
        if check.returncode:raise QABlocked("Read-only catalog inspection failed")
        available=check.stdout.decode(errors="replace")
        report["canvasDbExists"]=available.splitlines()[-1].strip().endswith("|1") if available.splitlines() else False
        if report["canvasDbExists"]:
            catalog_statement="""BEGIN TRANSACTION READ ONLY;
SELECT json_build_object(
    'accounts',to_regclass('public.accounts') IS NOT NULL,
    'terms',to_regclass('public.terms_of_services') IS NOT NULL,
    'shards',to_regclass('public.switchman_shards') IS NOT NULL,
    'migrations',to_regclass('public.schema_migrations') IS NOT NULL
);
ROLLBACK;
"""
            catalog_result=command(["docker","exec","-i","-e","PGHOST=/tmp",
                "-e","PGOPTIONS=-c default_transaction_read_only=on",
                clone_container,"psql","-X","-q","-A","-t","-v","ON_ERROR_STOP=1",
                "-U","postgres","-d","canvas_development"],
                stdin=catalog_statement.encode(),timeout=25)
            if catalog_result.returncode:raise QABlocked("Cannot inspect historical schema catalog")
            catalog=json.loads(text(catalog_result).splitlines()[-1])
            report["catalog"]=catalog
            if not all(catalog.values()):
                report["status"]="BLOCKED"
                report["reason"]="Historical Canvas schema is missing required tables"
                return report
            query="""BEGIN TRANSACTION READ ONLY;
SELECT (SELECT count(*) FROM public.accounts),
       (SELECT count(*) FROM public.terms_of_services),
       (SELECT count(*) FROM public.switchman_shards),
       (SELECT count(*) FROM public.schema_migrations);
ROLLBACK;
"""
            result=command(["docker","exec","-i","-e","PGHOST=/tmp",
                "-e","PGOPTIONS=-c default_transaction_read_only=on",
                clone_container,"psql","-X","-q","-A","-t","-v","ON_ERROR_STOP=1",
                "-U","postgres","-d","canvas_development"],stdin=query.encode(),timeout=25)
            if result.returncode:
                report["status"]="BLOCKED"
                report["reason"]="Historical Canvas schema differs from expected structure"
            else:
                data=[line.strip() for line in text(result).splitlines() if line.strip()]
                record=data[-1].split("|") if data else []
                if len(record)==4 and all(x.isdecimal() for x in record):
                    report["counts"]=dict(zip(("accounts","terms","shards","migrations"),map(int,record)))
                    report["status"]="PASS"
                    integrity_sql="""BEGIN TRANSACTION READ ONLY;
SELECT
 (SELECT count(*) FROM public.terms_of_services t
   LEFT JOIN public.accounts a ON a.id=t.account_id WHERE a.id IS NULL),
 (SELECT count(*) FROM pg_constraint WHERE contype='f' AND NOT convalidated),
 (SELECT count(*) FROM public.accounts WHERE id=100000000000001),
 (SELECT count(*) FROM pg_constraint
   WHERE conrelid='public.terms_of_services'::regclass AND contype='f');
ROLLBACK;
"""
                    probe=command(["docker","exec","-i","-e","PGHOST=/tmp",
                        "-e","PGOPTIONS=-c default_transaction_read_only=on",
                        clone_container,"psql","-X","-q","-A","-t","-v","ON_ERROR_STOP=1",
                        "-U","postgres","-d","canvas_development"],stdin=integrity_sql.encode(),timeout=25)
                    if probe.returncode:raise QABlocked("Cannot inspect historical referential integrity")
                    parts=text(probe).splitlines()[-1].split("|")
                    if len(parts)!=4 or not all(x.isdecimal() for x in parts):
                        raise QABlocked("Unexpected historical integrity format")
                    report["integrity"]=dict(zip(
                        ("orphanTerms","unvalidatedForeignKeys","globalIdStoredLocally","termsForeignKeys"),
                        map(int,parts)))
                    if report["integrity"]["orphanTerms"] or report["integrity"]["unvalidatedForeignKeys"]:
                        report["status"]="REVIEW"
                    if catalog.get("accounts") and catalog.get("migrations"):
                        report["ltiMetadata"]=inspect_lti_catalog(clone_container,qa_client_id())
                else:raise QABlocked("Unknown SQL output format")
        else:
            report["status"]="BLOCKED"
            report["reason"]="No canvas_development DB in historical copy"
    except QABlocked as error:
        report["status"]="BLOCKED"
        report["reason"]=str(error)
    finally:
        # Only remove uniquely labeled disposable resources created by this run.
        if container_created:
            try:
                obj=docker_metadata("container",clone_container)
                labels=obj.get("Config",{}).get("Labels") or {}
                if labels.get("qa.historical.owner")!=owned or labels.get("qa.historical.disposable")!="true":
                    raise QABlocked("QA container cleanup identity mismatch")
                command(["docker","rm","-f",clone_container],timeout=40)
            except QABlocked:
                report["status"]="FAIL"
                report["cleanupError"]="Temporary container identity mismatch"
        if volume_created:
            try:
                obj=docker_metadata("volume",clone_volume)
                labels=obj.get("Labels") or {}
                if labels.get("qa.historical.owner")!=owned or labels.get("qa.historical.disposable")!="true":
                    raise QABlocked("QA volume cleanup identity mismatch")
                deleted=command(["docker","volume","rm",clone_volume],timeout=30)
                if deleted.returncode:raise QABlocked("Disposable volume still in use")
            except QABlocked:
                report["status"]="FAIL"
                report["cleanupError"]="Temporary volume could not be removed safely"
        report["cleanupConfirmed"] = bool(
            (not container_created or command(["docker","inspect",clone_container],timeout=10).returncode!=0)
            and (not volume_created or command(["docker","volume","inspect",clone_volume],timeout=10).returncode!=0))
        if not report["cleanupConfirmed"]:report["status"]="FAIL"
    return report

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--mode",choices=("inventory","build","volume","syntax"),required=True)
    parser.add_argument("--name",help="Source key for build/volume")
    parser.add_argument("--report",required=True)
    args=parser.parse_args()
    require_qa()
    target=Path(args.report).resolve()
    if not target.is_relative_to(QA_ROOT.resolve()):
        raise QABlocked("QA report path outside authorized artifact directory")
    if args.mode=="inventory":payload=inventory()
    elif args.mode=="build":payload=build_source(args.name)
    elif args.mode=="syntax":payload=check_source_syntax(args.name)
    else:payload=clone_pg(args.name)
    result={"timestamp":datetime.now(timezone.utc).isoformat(),"mode":args.mode,
            "writeLocations":"isolated QA only","interactiveMenuModified":False,
            "originalSourcesModified":False,"originalVolumesModified":False,
            "result":payload}
    target.write_text(json.dumps(result,ensure_ascii=False,indent=2)+"\n")
    target.chmod(0o600)
    if args.mode=="inventory":
        print("QA_HISTORY_INVENTORY",len(payload["sources"]),"sources",len(payload["historicalPostgres"]),"databases")
    else:
        print("QA_HISTORY_RESULT",args.name,payload.get("status"),
              "cleanup",payload.get("cleanupConfirmed","not_applicable"),
              "counts",payload.get("counts","not_available"))
    print("QA_HISTORY_REPORT",str(target))
    return 0 if args.mode=="inventory" or payload["status"]=="PASS" else 2

if __name__=="__main__":
    try:sys.exit(main())
    except (QABlocked,OSError,ValueError) as exc:
        print("QA_HISTORY_BLOCKED",str(exc),file=sys.stderr)
        sys.exit(3)
