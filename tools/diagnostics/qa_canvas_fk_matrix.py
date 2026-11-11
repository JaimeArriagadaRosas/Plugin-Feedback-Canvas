#!/usr/bin/env python3
"""Transactional, fail-closed FK and schema-fault experiments against disposable QA Canvas PostgreSQL.

All statements use BEGIN + ROLLBACK (and explicit negative IDs to avoid sequence changes).
Never run against production or a user's historical installation.
"""
import json
import os
import re
import subprocess
import sys
from datetime import datetime, timezone

TARGET = os.environ.get('QA_CANVAS_PG_CONTAINER', 'qa-feedback-20261110-postgres-1')
PROJECT = os.environ.get('QA_EXPECT_COMPOSE_PROJECT', 'qa-feedback-20261110')
DATABASE = 'canvas_development'
DUMMY_ID = '-9000000000000000888'

def docker(*args, stdin=None):
    return subprocess.run(['docker', *args], input=stdin, text=True, capture_output=True, timeout=45, check=False)

def verify_isolated_target():
    if os.environ.get('QA_ALLOW_FAULT_INJECTION') != 'true':
        raise RuntimeError('Missing explicit QA_ALLOW_FAULT_INJECTION=true')
    if not re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9_.-]{2,126}', TARGET) or not PROJECT.startswith('qa-'):
        raise RuntimeError('Only explicit isolated qa- project and valid container names are accepted')
    result = docker('inspect', TARGET, '--format', '{{json .}}')
    if result.returncode:
        raise RuntimeError('Cannot inspect target: ' + result.stderr[:180])
    container = json.loads(result.stdout)
    labels = container.get('Config', {}).get('Labels') or {}
    if (labels.get('com.docker.compose.project') != PROJECT
            or labels.get('com.docker.compose.service') != 'postgres'
            or container.get('State', {}).get('Running') is not True):
        raise RuntimeError('Target is not the verified running Canvas PostgreSQL container in the isolated QA stack')

def psql(sql, database=DATABASE):
    return docker('exec','-i',TARGET,'psql','-X','-q','-At','-v','ON_ERROR_STOP=1',
                  '-U','postgres','-d',database,stdin=sql)

FINGERPRINT = """
SELECT md5(
  (SELECT string_agg(id::text || ':' || COALESCE(name,''), ';' ORDER BY id) FROM public.accounts)
  || '/' ||
  (SELECT string_agg(id::text || ':' || account_id::text, ';' ORDER BY id) FROM public.terms_of_services)
) AS fingerprint;
"""

def run():
    verify_isolated_target()
    baseline = psql(FINGERPRINT)
    if baseline.returncode: raise RuntimeError('Unable to read the initial integrity fingerprint')
    cases = [
        ('missing_global_account', f"BEGIN; INSERT INTO public.terms_of_services (id,account_id,terms_type,passive,created_at,updated_at,workflow_state) VALUES ({DUMMY_ID},100000000000001,'default',true,now(),now(),'active'); ROLLBACK;", 'fk_rails_337ba633a9', False),
        ('missing_local_account', f"BEGIN; INSERT INTO public.terms_of_services (id,account_id,terms_type,passive,created_at,updated_at,workflow_state) VALUES ({DUMMY_ID},999999,'default',true,now(),now(),'active'); ROLLBACK;", 'fk_rails_337ba633a9', False),
        ('existing_account_duplicate_terms', f"BEGIN; INSERT INTO public.terms_of_services (id,account_id,terms_type,passive,created_at,updated_at,workflow_state) VALUES ({DUMMY_ID},1,'default',true,now(),now(),'active'); ROLLBACK;", 'index_terms_of_services_on_account_id', False),
        ('valid_child_account_db_fk', f"BEGIN; INSERT INTO public.terms_of_services (id,account_id,terms_type,passive,created_at,updated_at,workflow_state) VALUES ({DUMMY_ID},4,'default',true,now(),now(),'active'); ROLLBACK;", '', True),
        ('missing_search_path', 'BEGIN; SET LOCAL search_path TO pg_temp; SELECT count(*) FROM terms_of_services; ROLLBACK;', 'does not exist', False),
    ]
    report={'timestamp':datetime.now(timezone.utc).isoformat(),'project':PROJECT,'container':TARGET,'baseline':baseline.stdout.strip(),'tests':[]}
    for name, sql, marker, successful in cases:
        check=psql(sql)
        ok = (check.returncode == 0) if successful else (check.returncode != 0 and marker.lower() in check.stderr.lower())
        report['tests'].append({
            'case':name,'passed':ok,'errorMatchesExpected':marker if marker else None,
            'postgresError': 'none' if check.returncode == 0 else ('foreign_key' if 'foreign key' in check.stderr.lower() else 'different_database_error'),
            'executedInTransaction':True,'persisted':False
        })
        print(('PASS' if ok else 'FAIL') + ' ' + name + ' postgresql_exit=' + str(check.returncode))
    wrong_db=psql('SELECT count(*) FROM public.accounts;','postgres')
    ok=wrong_db.returncode!=0 and 'does not exist' in wrong_db.stderr.lower()
    report['tests'].append({'case':'wrong_database_has_no_canvas_schema','passed':ok,'executedInTransaction':False,'persisted':False})
    print(('PASS' if ok else 'FAIL') + ' wrong_database_has_no_canvas_schema')
    after=psql(FINGERPRINT)
    report['fingerprintUnchanged']=after.returncode==0 and baseline.stdout.strip()==after.stdout.strip()
    report['total']=len(report['tests'])
    report['passed']=sum(x['passed'] for x in report['tests'])
    print('POSTGRES_FINGERPRINT_UNCHANGED=' + str(report['fingerprintUnchanged']))
    print('QA_FAULT_MATRIX=' + str(report['passed']) + '/' + str(report['total']))
    destination=os.environ.get('QA_MATRIX_REPORT')
    if destination:
        with open(destination,'w',encoding='utf8') as file: json.dump(report,file,indent=2,ensure_ascii=False)
    return 0 if report['passed']==report['total'] and report['fingerprintUnchanged'] else 1

if __name__=='__main__':
    try: sys.exit(run())
    except Exception as exc:
        print('QA fault matrix stopped safely: '+str(exc),file=sys.stderr)
        sys.exit(3)
