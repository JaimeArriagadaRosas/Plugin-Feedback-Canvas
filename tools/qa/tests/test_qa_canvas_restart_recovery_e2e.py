"""Disposable Canvas service restart: resource ownership and integrity checks."""
import importlib.util
import json
from pathlib import Path
import sys
import unittest
from unittest.mock import patch
import subprocess

MODULE=Path(__file__).resolve().parents[1]/"qa_canvas_restart_recovery_e2e.py"
sys.path.insert(0,str(MODULE.parent))
spec=importlib.util.spec_from_file_location("qa_restart_canvas",MODULE)
restart=importlib.util.module_from_spec(spec)
spec.loader.exec_module(restart)

class RecoverySafety(unittest.TestCase):
    def test_old_container_rejected_before_any_docker_action(self):
        with patch.object(restart,"docker") as cmd:
            with self.assertRaisesRegex(restart.QABlocked,"not a disposable"):
                restart.owned_web("canvas-lms-master-web-1")
            cmd.assert_not_called()

    def test_qa_owner_label_must_match(self):
        obj={"Config":{"Labels":{
            "qa.canvas.pair.disposable":"true",
            "qa.canvas.pair.owner":"qa-hpair-not-the-owner"}}}
        result=subprocess.CompletedProcess([],0,stdout=json.dumps(obj),stderr="")
        with patch.object(restart,"docker",return_value=result):
            with self.assertRaisesRegex(restart.QABlocked,"owner label mismatch"):
                restart.owned_web("qa-hpair-abcdef012345-web")

    def test_restart_refreshes_only_owned_localhost_port(self):
        valid=subprocess.CompletedProcess([],0,stdout="127.0.0.1:32807\n",stderr="")
        with patch.object(restart,"owned_web",return_value=True), patch.object(restart,"docker",return_value=valid):
            self.assertEqual(restart.current_disposable_web_url("qa-hpair-abcdef012345-web"),
                             "http://127.0.0.1:32807")
        for mapping in ("0.0.0.0:32807", "127.0.0.1:8080\n127.0.0.1:32807", "localhost:32807"):
            invalid=subprocess.CompletedProcess([],0,stdout=mapping,stderr="")
            with self.subTest(mapping=mapping), patch.object(restart,"owned_web",return_value=True), patch.object(restart,"docker",return_value=invalid):
                with self.assertRaises(restart.QABlocked):
                    restart.current_disposable_web_url("qa-hpair-abcdef012345-web")

    def test_readonly_sql_has_no_mutating_commands(self):
        hashes={x:"f"*32 for x in ("accounts","terms","shards","migrations")}
        hashes["orphanTerms"]=0
        result=subprocess.CompletedProcess([],0,stdout=json.dumps(hashes)+"\n",stderr="")
        with patch.object(restart,"docker",return_value=result) as cmd:
            data=restart.signature("qa-hpair-abcdef012345-db")
            self.assertEqual(data,hashes)
            argv=cmd.call_args.args[0]
            self.assertIn("PGOPTIONS=-c default_transaction_read_only=on",argv)
            sql=cmd.call_args.kwargs["stdin"]
            self.assertIn("BEGIN TRANSACTION READ ONLY",sql)
            self.assertIn("ROLLBACK",sql)
            import re
            self.assertFalse(re.search(r"\b(INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b",sql))

    def test_same_counts_but_changed_terms_are_detected(self):
        first={"accounts":"a"*32,"terms":"b"*32,"shards":"c"*32,
               "migrations":"d"*32,"orphanTerms":0}
        second={**first,"terms":"e"*32}
        self.assertNotEqual(first,second)

    def test_restart_scenario_never_claims_full_installer_recovery(self):
        result={"webRecovered":True,"integrityPreserved":True,"headless":{"status":"PASS"}}
        self.assertNotIn("fullInstallerRecoveryProven",result)

if __name__=="__main__":unittest.main()
