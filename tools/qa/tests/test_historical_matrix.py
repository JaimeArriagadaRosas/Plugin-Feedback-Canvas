"""Evidence aggregation must never mislabel an unsupported old database as healthy."""
import importlib.util
from pathlib import Path
import json
from tempfile import TemporaryDirectory
import unittest

SOURCE=Path(__file__).resolve().parents[1]/"historical_matrix.py"
spec=importlib.util.spec_from_file_location("historical_matrix_qa",SOURCE)
lab=importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab)

class HistoricalMatrixTests(unittest.TestCase):
    def test_old_schema_with_no_canvas_tables_safely_blocks(self):
        item=lab.classified_db("october-alternate-db",{
            "status":"BLOCKED", "cleanupConfirmed":True,
            "catalog":{"accounts":False,"terms":False,"shards":False,"migrations":False},
            "reason":"Historical Canvas schema is missing required tables"
        })
        self.assertEqual(item["status"],"SAFELY_BLOCKED")
        self.assertFalse(item["schemaCatalog"]["accounts"])

    def test_unconfirmed_cleanup_is_failure_even_if_db_query_passed(self):
        record={"status":"PASS","cleanupConfirmed":False,
                "counts":{"accounts":5},"catalog":{"accounts":True}}
        self.assertEqual(lab.classified_db("august-canvas-db",record)["status"],"FAIL")

    def test_zero_orphan_real_clone_is_valid_qa_not_login_claim(self):
        record={"status":"PASS","cleanupConfirmed":True,
                "catalog":{"accounts":True,"terms":True,"shards":True,"migrations":True},
                "counts":{"accounts":5,"terms":3,"shards":1,"migrations":94},
                "integrity":{"orphanTerms":0,"unvalidatedForeignKeys":0}}
        item=lab.classified_db("august-canvas-db",record)
        self.assertEqual(item["status"],"PASS")
        self.assertEqual(item["kind"],"read_only_historical_postgres_clone")

    def test_git_archive_syntax_not_mislabeled_as_full_build(self):
        result={"status":"PASS","stage":"syntax","filesChecked":312,"syntaxFailures":[]}
        self.assertEqual(lab.classified_syntax("august-main",result)["status"],"PASS")
        self.assertNotEqual(lab.classified_build("august-main",result)["status"],"PASS")

    def test_missing_result_marks_not_run(self):
        self.assertEqual(lab.classified_build("october-original",None)["status"],"NOT_RUN")
        self.assertEqual(lab.classified_db("august-canvas-db",None)["status"],"NOT_RUN")

    def test_matrix_keeps_cross_version_login_not_verified(self):
        with TemporaryDirectory() as directory:
            root=Path(directory)
            (root/"august-main-syntax.json").write_text(json.dumps({"result":{
                "status":"PASS","stage":"syntax","filesChecked":100,"syntaxFailures":[]}}))
            result=lab.consolidate(root)
            self.assertFalse(result["sourceAndDbCrossVersionLoginE2E"])
            self.assertFalse(result["rootCauseOfProfessorLoginFkConfirmed"])
            self.assertFalse(result["multiShardEndToEndAvailable"])
            self.assertGreater(result["incomplete"],0)
            self.assertEqual(result["verified"],1)

if __name__=="__main__":unittest.main()
