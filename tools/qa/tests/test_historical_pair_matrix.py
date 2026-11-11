"""Strict cross-version evidence: never promote a GET 500 to the professor POST FK."""
import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
import json
import unittest

SCRIPT=Path(__file__).resolve().parents[1]/"historical_pair_matrix.py"
spec=importlib.util.spec_from_file_location("qa_pair_matrix",SCRIPT)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

def good(**overrides):
    return {"result":{"status":"PASS_HTTP","httpStatus":200,
       "headlessStatus":"PASS","browserChecks":7,"browserPassCount":7,
       "cleanupConfirmed":True,"originalResourcesModified":False,**overrides}}

def fail_http():
    return {"result":{"status":"BLOCKED","httpStatus":500,
       "headlessStatus":"NOT_RUN","cleanupConfirmed":True,
       "originalResourcesModified":False}}

class HistoricalPairEvidenceTests(unittest.TestCase):
    def test_real_login_succeeds_only_with_browser_post_checks(self):
        self.assertEqual(module.evaluate("august",good())["status"],"PASS")
        self.assertEqual(module.evaluate("august",good(browserPassCount=6))["status"],"NOT_VERIFIED")
        self.assertEqual(module.evaluate("october",good(httpStatus=500))["status"],"NOT_VERIFIED")

    def test_matched_key_comparison_requires_matching_key_indicator(self):
        name="august-web-october-data-matched-key"
        self.assertEqual(module.evaluate(name,good())["status"],"NOT_VERIFIED")
        result=good(keyCompatibility="matched_to_copied_database_owner")
        self.assertEqual(module.evaluate(name,result)["status"],"PASS")

    def test_no_cleanup_or_original_mutation_is_never_a_pass(self):
        self.assertEqual(module.evaluate("august",good(cleanupConfirmed=False))["status"],"FAIL")
        self.assertEqual(module.evaluate("august",good(originalResourcesModified=True))["status"],"FAIL")

    def test_get_500_before_post_is_not_professor_fk(self):
        name="august-web-october-data"
        out=module.evaluate(name,fail_http())
        self.assertEqual(out["status"],"REPRODUCED_GET_500")
        self.assertFalse(out["postLogin"])
        self.assertNotIn("professorFk",out)

    def test_incomplete_schema_blocks_rails_before_start(self):
        data={"result":{"status":"SAFELY_BLOCKED","cleanupConfirmed":True,
             "originalResourcesModified":False,"headlessStatus":"NOT_RUN_SCHEMA_BLOCKED",
             "schemaCatalog":{"accounts":False,"terms":False,"shards":False,"migrations":False}}}
        r=module.evaluate("october-incomplete",data)
        self.assertEqual(r["status"],"SAFELY_BLOCKED")
        self.assertFalse(r["webStarted"])

    def test_complete_matrix_never_claims_lti_or_original_fk(self):
        with TemporaryDirectory() as tmp:
            root=Path(tmp)
            for name in module.HIST:
                if name=="october-incomplete":
                    record={"result":{"status":"SAFELY_BLOCKED","cleanupConfirmed":True,
                        "originalResourcesModified":False,"headlessStatus":"NOT_RUN_SCHEMA_BLOCKED",
                        "schemaCatalog":{"accounts":False}}}
                elif "matched-key" in name:
                    record=good(keyCompatibility="matched_to_copied_database_owner")
                elif name in ("august","october"):
                    record=good()
                else:
                    record=fail_http()
                (root/("qa-historical-pair-"+name+"-20261111.json")).write_text(json.dumps(record))
            summary=module.summarize(root)
            self.assertTrue(summary["experimentalMatrixComplete"])
            self.assertEqual(summary["passedHeadlessLogins"],4)
            self.assertEqual(summary["naturalGet500MismatchCases"],2)
            self.assertFalse(summary["crossVersionLtiConfirmed"])
            self.assertFalse(summary["professorExactFkReproduced"])

    def test_incomplete_matrix_is_not_complete(self):
        with TemporaryDirectory() as tmp:
            report=module.summarize(Path(tmp))
            self.assertFalse(report["experimentalMatrixComplete"])
            self.assertTrue(all(case["status"]=="NOT_RUN" for case in report["cases"]))

if __name__=="__main__":unittest.main()
