"""Fail-closed checks for the one-shot causal laboratory (standard-library unittest)."""
import importlib.util
import json
import os
from pathlib import Path
import unittest
from unittest.mock import patch
import subprocess

ROOT=Path(__file__).resolve().parents[1]
def load_module(name, filename):
    spec=importlib.util.spec_from_file_location(name,ROOT/filename)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

history=load_module("historylab","qa_canvas_history_lab.py")
persistence=load_module("persistencelab","qa_canvas_persistence_matrix.py")
trace=load_module("shardtrace","qa_canvas_shard_trace.py")
workflow=load_module("causalworkflow","qa_canvas_investigate.py")

class HistoryLabTests(unittest.TestCase):
    def test_requires_explicit_optin_before_any_docker_call(self):
        with patch.dict(os.environ,{},clear=True):
            with patch.object(history,"run") as execute:
                with self.assertRaisesRegex(RuntimeError,"QA_ALLOW_HISTORY_LAB"):
                    history.verified_target("qa-postgres","qa-feedback-20261110",
                        str(Path.home()/"qa-feedback-20261110/clean/canvas-lms-master"))
                execute.assert_not_called()

    def test_forged_compose_project_is_refused(self):
        with patch.dict(os.environ,{"QA_ALLOW_HISTORY_LAB":"true"}):
            with self.assertRaisesRegex(RuntimeError,"qa- Compose"):
                history.verified_target("qa-postgres","production",
                    str(Path.home()/"qa-feedback-20261110/clean/canvas-lms-master"))

    def test_scenario_transacts_and_rolls_back(self):
        observed=[]
        def mock_sql(container,dbname,statement):
            observed.append(statement)
            return subprocess.CompletedProcess([],0,stdout=b"0\n",stderr=b"")
        with patch.object(history,"sql",side_effect=mock_sql):
            result=history.experiment("qa","temporary","missing_terms",
                                      "SELECT 0;",success=True,expected_output=0)
        self.assertTrue(result["passed"])
        self.assertEqual(result["mode"],"transaction_rolled_back")
        self.assertIn("BEGIN;",observed[0])
        self.assertIn("ROLLBACK;",observed[0])
        self.assertNotIn("COMMIT",observed[0])

    def test_fk_failure_is_categorized_without_exposing_id_or_pg_error(self):
        message=("ERROR: insert or update on table terms_of_services violates foreign key "
                 "constraint fk_rails_337ba633a9. Key (account_id)=(100000000000001)")
        fake=subprocess.CompletedProcess([],3,stdout=b"",stderr=message.encode())
        with patch.object(history,"sql",return_value=fake):
            result=history.experiment("qa","temporary","legacy_fk","UPDATE accounts",
                                      success=False,marker="fk_rails_337ba633a9")
        self.assertTrue(result["passed"])
        self.assertEqual(result["sqlOutcome"],"fk_rejected")
        self.assertNotIn("100000000000001",json.dumps(result))

    def test_selected_snapshot_fingerprint_format_rejects_wrong_data(self):
        fake=subprocess.CompletedProcess([],0,stdout=b"invalid",stderr=b"")
        with patch.object(history,"sql",return_value=fake):
            with self.assertRaisesRegex(RuntimeError,"fingerprint"):
                history.get_fingerprint("qa","cloned")

class PersistenceLabTests(unittest.TestCase):
    def test_all_seven_drift_classifications(self):
        baseline={
            "owner":"qa-demo","service":"postgres","workingDir":"/home/test/qa-project",
            "image":"postgres:15-alpine","running":True,
            "portFingerprint":[("5432/tcp",("55432",))],
            "volumeIdentityHashes":[("/var/lib/postgresql/data","hash")]
        }
        report=persistence.simulations(baseline)
        self.assertEqual(len(report),7)
        self.assertTrue(all(item["passed"] for item in report))
        self.assertEqual(report[0]["detectedDrift"],[])
        self.assertEqual(report[1]["detectedDrift"],["owner_mismatch"])

    def test_missing_service_stays_unknown_not_healthy(self):
        self.assertEqual(persistence.discrepancies({"owner":"qa"},None),["service_missing"])

    def test_environment_reader_only_returns_key_names(self):
        from tempfile import TemporaryDirectory
        with TemporaryDirectory() as directory:
            path=Path(directory)/".env"
            path.write_text("SAMPLE_KEY=opaque-fixture-value\nDB_PORT=55432\n# COMMENT=ignored\n")
            self.assertEqual(persistence.env_keys(path),{"SAMPLE_KEY","DB_PORT"})
            self.assertNotIn("opaque-fixture-value",str(persistence.env_keys(path)))

class ShardTraceTests(unittest.TestCase):
    def test_requires_explicit_permission_before_docker(self):
        with patch.dict(os.environ,{},clear=True):
            with patch.object(trace.subprocess,"run") as execute:
                with self.assertRaisesRegex(RuntimeError,"QA_ALLOW_SHARD_TRACE"):
                    trace.verify("qa-demo-web","qa-feedback-20261110",
                                 str(Path.home()/"qa-feedback-20261110/clean/canvas-lms-master"))
                execute.assert_not_called()

    def test_rejects_non_qa_project(self):
        with patch.dict(os.environ,{"QA_ALLOW_SHARD_TRACE":"true"}):
            with self.assertRaisesRegex(RuntimeError,"qa-"):
                trace.verify("some-web","production",
                            str(Path.home()/"qa-feedback-20261110/clean/canvas-lms-master"))

class WorkflowTests(unittest.TestCase):
    def test_missing_report_not_success(self):
        with patch.object(Path,"is_file",return_value=False):
            self.assertEqual(workflow.check_result(Path("/tmp/no-report"),0)["ok"],False)
        self.assertFalse(workflow.check_result(Path("/tmp/ignored"),1)["ok"])

    def test_browser_stays_blocked_when_qa_listener_is_absent(self):
        no_listener=subprocess.CompletedProcess([],0,stdout="",stderr="")
        with patch.object(workflow.subprocess,"run",return_value=no_listener):
            self.assertFalse(workflow.headless_qa_owner_verified())

    def test_browser_stays_blocked_for_unrelated_listener(self):
        misleading=subprocess.CompletedProcess([],0,stdout=
            'LISTEN 0 511 *:8443 *:* users:(("node",pid=999999,fd=29))',stderr="")
        with patch.object(workflow.subprocess,"run",return_value=misleading):
            self.assertFalse(workflow.headless_qa_owner_verified())

if __name__=="__main__":
    unittest.main()
