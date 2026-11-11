"""Safety and classification tests for the real disposable FK/recovery suite."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

HERE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(HERE))
import disposable_canvas_faults as faults
import failure_recovery_e2e as suite

class DisposableFaultTests(unittest.TestCase):
    def test_only_exact_disposable_pair_container_is_accepted(self):
        for container in ("canvas-postgres-1","qa-hpair-aabbccddeeff-web",
                          "qa-hpair-ABCD12345678-db","qa-hpair-aabbccddeeff-db;rm"):
            with self.subTest(container=container),patch.object(faults.subprocess,"run") as run:
                with self.assertRaises(faults.QABlocked):
                    faults.verified_database(container)
                run.assert_not_called()

    def test_label_owner_mismatch_blocks(self):
        value={"Config":{"Labels":{"qa.canvas.pair.disposable":"true",
                                   "qa.canvas.pair.owner":"qa-hpair-wrong"}},
               "State":{"Running":True}}
        proc=subprocess.CompletedProcess([],0,stdout=json.dumps(value),stderr="")
        with patch.object(faults.subprocess,"run",return_value=proc):
            with self.assertRaises(faults.QABlocked):
                faults.verified_database("qa-hpair-aabbccddeeff-db")

    def test_stopped_container_blocks(self):
        value={"Config":{"Labels":{"qa.canvas.pair.disposable":"true",
                                   "qa.canvas.pair.owner":"qa-hpair-aabbccddeeff"}},
               "State":{"Running":False}}
        proc=subprocess.CompletedProcess([],0,stdout=json.dumps(value),stderr="")
        with patch.object(faults.subprocess,"run",return_value=proc):
            with self.assertRaises(faults.QABlocked):
                faults.verified_database("qa-hpair-aabbccddeeff-db")

    def test_fk_write_never_has_commit_and_uses_explicit_id(self):
        for account in (999999,100000000000001,4):
            sql=faults.sql_insertion(account)
            self.assertIn("BEGIN;",sql)
            self.assertIn("ROLLBACK;",sql)
            self.assertIn(str(faults.DUMMY),sql)
            self.assertNotIn("COMMIT",sql)
            self.assertNotIn("nextval(",sql)

    def test_invalid_dynamic_account_rejected(self):
        for account in ("1; DROP TABLE accounts",0,-2,10**19):
            with self.assertRaises(faults.QABlocked):
                faults.sql_insertion(account)

    def test_real_fk_error_is_not_claimed_to_reproduce_rails_login(self):
        message='ERROR: insert or update on table "terms_of_services" violates foreign key constraint "fk_rails_337ba633a9"'
        with patch.object(faults,"postgres",return_value=(True,message)):
            actual=faults.case_failure("qa-hpair-aabbccddeeff-db","synthetic",999999)
        self.assertEqual(actual["status"],"PASS_SAFE_BLOCK")
        self.assertFalse(actual["railsLoginNaturallyReproduced"])

    def test_unrelated_error_is_failure_not_success(self):
        with patch.object(faults,"postgres",return_value=(True,"permission denied")):
            actual=faults.case_failure("qa-hpair-aabbccddeeff-db","synthetic",999999)
        self.assertEqual(actual["status"],"FAIL")

    def test_matrix_requires_unchanged_integrity_and_valid_control(self):
        fingerprint={k:"a"*32 for k in ("accountIds","termsLinks","shards","migrations")}
        fingerprint.update({"constraint":1,"orphans":0})
        failure={"name":"fk","status":"PASS_SAFE_BLOCK"}
        valid={"name":"valid","status":"PASS_REFERENCE_ACCEPTED"}
        with patch.object(faults,"snapshot",side_effect=[fingerprint,fingerprint]), \
             patch.object(faults,"postgres",return_value="0"), \
             patch.object(faults,"case_failure",return_value=failure), \
             patch.object(faults,"positive_control",return_value=valid):
            self.assertEqual(faults.run_matrix("qa-hpair-aabbccddeeff-db")["status"],"PASS")
        modified={**fingerprint,"termsLinks":"b"*32}
        with patch.object(faults,"snapshot",side_effect=[fingerprint,modified]), \
             patch.object(faults,"postgres",return_value="0"), \
             patch.object(faults,"case_failure",return_value=failure), \
             patch.object(faults,"positive_control",return_value=valid):
            self.assertEqual(faults.run_matrix("qa-hpair-aabbccddeeff-db")["status"],"FAIL")

class RecoverySuiteTests(unittest.TestCase):
    def test_baseline_must_precede_fault_injection(self):
        with patch.object(suite,"launch_in_disposable_canvas",
                          return_value={"status":"FAIL"}) as browser, \
             patch.object(suite,"run_matrix") as fks:
            status=suite.full_login_and_fault_hook({"postgres":"qa-hpair-aabbccddeeff-db"})
            self.assertEqual(status["status"],"BLOCKED")
            browser.assert_called_once()
            fks.assert_not_called()

    def test_success_requires_browser_again_after_rollback(self):
        good={"status":"PASS","actualLtiLaunchConfirmed":True,
              "backendCleanupConfirmed":True,"backendSourceUnchanged":True}
        restored={"status":"PASS","dataIntegrityPreserved":True}
        with patch.object(suite,"launch_in_disposable_canvas",side_effect=[good,good]) as browser, \
             patch.object(suite,"run_matrix",return_value=restored):
            result=suite.full_login_and_fault_hook({"postgres":"qa-hpair-aabbccddeeff-db"})
        self.assertEqual(browser.call_count,2)
        self.assertEqual(result["status"],"PASS")
        self.assertEqual(result["actualRecovery"],"TRANSACTION_ROLLBACK")

    def test_no_false_pass_when_second_lti_fails(self):
        good={"status":"PASS","actualLtiLaunchConfirmed":True,
              "backendCleanupConfirmed":True,"backendSourceUnchanged":True}
        with patch.object(suite,"launch_in_disposable_canvas",side_effect=[good,{"status":"FAIL"}]), \
             patch.object(suite,"run_matrix",return_value={"status":"PASS","dataIntegrityPreserved":True}):
            result=suite.full_login_and_fault_hook({"postgres":"qa-hpair-aabbccddeeff-db"})
        self.assertEqual(result["status"],"FAIL")

    def test_report_keeps_unverified_distinct_from_success(self):
        import tempfile
        with tempfile.TemporaryDirectory() as folder:
            target=Path(folder)/"report.json"
            cases=[suite.record("fk","PASS_SAFE_BLOCK","good"),
                   suite.record("multishard","NOT_VERIFIED","missing fixture"),
                   suite.record("installer","INTEGRATION_ONLY","simulated external dependencies")]
            value=suite.report_progress(target,cases)
            self.assertFalse(value["allScenariosFullyCertified"])
            self.assertEqual(value["unverified"],["multishard","installer"])
            self.assertEqual(target.stat().st_mode & 0o777,0o600)

class SanitizedDockerFailureTests(unittest.TestCase):
    def test_docker_stderr_is_classified_without_leaking_secrets(self):
        import disposable_services as services
        for message, expected in (
            ("Error: dependency service unhealthy; SECRET=value", "unhealthy"),
            ("bind: address already in use; PRIVATE_TOKEN=abc", "port_conflict"),
        ):
            with self.subTest(expected=expected):
                result=subprocess.CompletedProcess([],1,stdout="",stderr=message)
                with patch.object(services.subprocess,"run",return_value=result):
                    with self.assertRaises(services.QAFailed) as raised:
                        services.call(["docker","compose","up"],timeout=5)
                self.assertIn(expected,str(raised.exception))
                self.assertNotIn("SECRET",str(raised.exception))
                self.assertNotIn("PRIVATE_TOKEN",str(raised.exception))

class DisposableRecoverySentinelTests(unittest.TestCase):
    def test_idempotent_qa_sentinel_retries_with_fresh_owner_check(self):
        from unittest.mock import Mock
        import qa_three_recovery_scenarios as recovery
        lab=Mock()
        lab.container.return_value="qa-compat-12345678-db-1"
        error=subprocess.CompletedProcess([],1,stdout="",stderr="startup pending")
        healthy=subprocess.CompletedProcess([],0,stdout="",stderr="")
        with patch.object(recovery,"call",side_effect=[error,healthy]) as cmd, \
             patch.object(recovery.time,"sleep") as pause:
            response=recovery.sentinel(lab)
        self.assertEqual(cmd.call_count,2)
        self.assertEqual(lab.inspect.call_count,2)
        pause.assert_called_once_with(2)
        self.assertEqual(response[0:3],["docker","exec","qa-compat-12345678-db-1"])

    def test_retries_stop_after_three_attempts(self):
        from unittest.mock import Mock
        import qa_three_recovery_scenarios as recovery
        lab=Mock()
        lab.container.return_value="qa-compat-12345678-db-1"
        error=subprocess.CompletedProcess([],1,stdout="",stderr="startup pending")
        with patch.object(recovery,"call",return_value=error) as cmd, \
             patch.object(recovery.time,"sleep") as pause:
            with self.assertRaises(recovery.QAFailed):
                recovery.sentinel(lab)
        self.assertEqual(cmd.call_count,3)
        self.assertEqual(lab.inspect.call_count,3)
        self.assertEqual(pause.call_count,2)

if __name__=="__main__":
    unittest.main()
