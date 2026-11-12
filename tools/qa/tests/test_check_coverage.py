"""Checks never classify false positives as E2E success."""
import importlib.util
from pathlib import Path
import unittest

MODULE=Path(__file__).resolve().parents[1]/"check_coverage.py"
spec=importlib.util.spec_from_file_location("qa_coverage",MODULE)
coverage=importlib.util.module_from_spec(spec)
spec.loader.exec_module(coverage)

class CoverageTests(unittest.TestCase):
    def test_reports_approved_docker_scenarios(self):
        data={"cleanupConfirmed":True,"results":[{"name":x,"status":"PASS"} for x in coverage.DOCKER]}
        self.assertTrue(coverage.check_report(data,coverage.DOCKER,requires_cleanup=True)["ok"])

    def test_blocks_unconfirmed_cleanup(self):
        data={"cleanupConfirmed":False,"results":[{"name":x,"status":"PASS"} for x in coverage.DOCKER]}
        self.assertFalse(coverage.check_report(data,coverage.DOCKER,requires_cleanup=True)["ok"])

    def test_blocks_duplicates_even_if_all_passed(self):
        data={"results":[{"case":x,"status":"PASS"} for x in coverage.BROWSER]}
        data["results"].append({"case":coverage.BROWSER[0],"status":"PASS"})
        self.assertFalse(coverage.check_report(data,coverage.BROWSER)["ok"])

    def test_blocks_skips_missing_and_failure(self):
        data={"results":[{"case":x,"status":"PASS"} for x in coverage.BROWSER]}
        data["results"][0]["status"]="SKIPPED"
        self.assertFalse(coverage.check_report(data,coverage.BROWSER)["ok"])
        data["results"][0]["status"]="FAIL"
        self.assertFalse(coverage.check_report(data,coverage.BROWSER)["ok"])
        data["results"].pop()
        self.assertFalse(coverage.check_report(data,coverage.BROWSER)["ok"])

    def test_one_new_real_port_e2e_reduces_gap_without_claiming_old_canvas_support(self):
        expected = {
            "external_occupied_port_e2e":"PASS",
            "interrupted_full_canvas_setup_e2e":"INTEGRATION_ONLY",
            "historical_canvas_version_upgrade_e2e":"NOT_VERIFIED",
            "real_multi_shard_account_login":"NOT_VERIFIED",
            "original_professor_fk_without_injection":"NOT_REPRODUCED"
        }
        result=coverage.check_remaining_scenarios({
            "cases":[{"scenario":key,"status":value} for key,value in expected.items()]
        })
        self.assertTrue(result["ok"])
        self.assertEqual(result["verified"],1)
        self.assertEqual(result["expected"],1)
        self.assertEqual(len(result["pending"]),4)
        self.assertIn("historical_canvas_version_upgrade_e2e",result["pending"])

    def test_false_multi_shard_success_is_refused(self):
        cases=[{"scenario":key,"status":"PASS"} for key in coverage.GAPS]
        result=coverage.check_remaining_scenarios({"cases":cases})
        self.assertFalse(result["ok"])
        self.assertIn("real_multi_shard_account_login_unexpected_status",result["issues"])

    def test_missing_or_duplicate_scenario_is_never_complete(self):
        cases=[{"scenario":key,"status":"PASS"} for key in coverage.GAPS]
        self.assertFalse(coverage.check_remaining_scenarios({"cases":cases[:-1]})["ok"])
        cases.append(cases[0])
        self.assertFalse(coverage.check_remaining_scenarios({"cases":cases})["ok"])

    def test_future_canvas_migration_and_multishard_are_explicit_gaps(self):
        self.assertIn("historical_canvas_version_upgrade_e2e",coverage.GAPS)
        self.assertIn("real_multi_shard_account_login",coverage.GAPS)
        self.assertIn("original_professor_fk_without_injection",coverage.GAPS)

if __name__=="__main__":
    unittest.main()
