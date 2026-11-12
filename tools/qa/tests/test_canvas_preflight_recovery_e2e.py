"""Guards for real disposable Docker / PostgreSQL preflight recovery."""
import os
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import qa_canvas_preflight_recovery_e2e as subject

class RecoveryPreflightTests(unittest.TestCase):
    def test_real_e2e_requires_explicit_flags_before_docker(self):
        with patch.dict(os.environ,{},clear=True),patch.object(subject,"run") as execution:
            with self.assertRaises(RuntimeError):
                subject.authorize()
            execution.assert_not_called()

    def test_invalid_project_names_are_rejected(self):
        for name in ("qa-preflight-ABCDEF000001","qa-preflight-a",
                     "canvas-production","qa-preflight-a1234567890b;rm"):
            with self.subTest(name=name),self.assertRaises(RuntimeError):
                subject.compose_file(name)

    def test_wrong_owner_fails_closed_before_database_access(self):
        result=subprocess.CompletedProcess([],0,stdout='''{
          "Config":{"Labels":{"com.docker.compose.project":"foreign",
                               "com.docker.compose.service":"postgres"}}
        }''',stderr="")
        with patch.object(subject,"run",return_value=result) as invoked:
            with self.assertRaises(RuntimeError):
                subject.validated_owner("qa-preflight-001122334455-postgres-1",
                                        "qa-preflight-001122334455")
            self.assertEqual(invoked.call_count,1)
            self.assertIn("inspect",invoked.call_args.args[0])

    def test_sql_stays_on_owned_disposable_container(self):
        with patch.object(subject,"validated_owner") as owned,\
             patch.object(subject,"run",return_value=subprocess.CompletedProcess([],0,
                              stdout="1\n",stderr="")) as invoked:
            output=subject.sql("qa-preflight-aabbccddeeff-postgres-1",
                               "qa-preflight-aabbccddeeff","SELECT 1;")
        owned.assert_called_once()
        self.assertEqual(output.stdout.strip(),"1")
        argv=invoked.call_args.args[0]
        self.assertEqual(argv[:3],["docker","exec","-i"])
        self.assertIn("canvas_development",argv)

    def test_probe_rejects_missing_structured_result(self):
        bad=subprocess.CompletedProcess([],0,stdout="arbitrary text",stderr="")
        with patch.object(subject,"run",return_value=bad):
            with self.assertRaises(RuntimeError):
                subject.json_probe(Path("/nonexistent"))

    def test_explicit_cleanup_and_real_rollback_are_prescribed(self):
        import inspect
        source=inspect.getsource(subject.scenario)
        self.assertIn('dcompose("down","-v"',source)
        self.assertIn("validated_owner(ids[0],project)",source)
        self.assertIn("SELECT 1/0;",source)
        self.assertIn("to_regclass('public.qa_interrupted_migration') IS NULL",source)
        self.assertIn("fullCanvasInstallationCertified",source)

if __name__=="__main__":
    unittest.main()
