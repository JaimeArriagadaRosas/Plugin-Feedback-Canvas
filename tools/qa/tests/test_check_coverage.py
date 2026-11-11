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

    def test_future_canvas_migration_and_multishard_are_explicit_gaps(self):
        self.assertIn("historical_canvas_version_upgrade_e2e",coverage.GAPS)
        self.assertIn("real_multi_shard_account_login",coverage.GAPS)
        self.assertIn("original_professor_fk_without_injection",coverage.GAPS)

if __name__=="__main__":
    unittest.main()
