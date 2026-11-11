"""Pure and fail-closed checks for read-only migration preflight."""
import importlib.util
import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
import subprocess

source = Path(__file__).resolve().parents[1] / "legacy_canvas_history.py"
spec=importlib.util.spec_from_file_location("qa_canvas_legacy_history",source)
legacy=importlib.util.module_from_spec(spec)
spec.loader.exec_module(legacy)

class CanvasLegacyHistoryTests(unittest.TestCase):
    def test_current_versions_are_compatible_and_test_only_is_ignored(self):
        result=legacy.classify(
            ["20260101000000","20260201000000","99999999999999999999"],
            ["20260101000000","20260201000000"],
            {"99999999999999999999"}
        )
        self.assertEqual(result["status"],"compatible")
        self.assertEqual(result["pendingCount"],0)

    def test_old_database_requires_review_not_auto_upgrade(self):
        result=legacy.classify(
            ["20260101000000","20260201000000"],
            ["20260101000000"]
        )
        self.assertEqual(result["status"],"review_required")
        self.assertEqual(result["code"],"CANVAS-DB-HISTORY-PENDING")

    def test_unknown_or_duplicate_version_blocks(self):
        known=["20260101000000","20260201000000"]
        unknown=legacy.classify(known,["20260101000000","20300101000000"])
        self.assertEqual(unknown["status"],"blocked")
        self.assertEqual(unknown["unknownCount"],1)
        duplicate=legacy.classify(known,["20260101000000","20260101000000"])
        self.assertEqual(duplicate["code"],"CANVAS-DB-HISTORY-DUPLICATE")

    def test_source_allows_multidot_real_canvas_filename(self):
        with TemporaryDirectory() as folder:
            location=Path(folder)/"db/migrate"
            location.mkdir(parents=True)
            (location/"20260120171905_add_migrate_from_jobs_shard.switchman_inst_jobs.rb").write_text("")
            (location/legacy.SPECIAL_TEST_ONLY).write_text("Rails.env.test?\n")
            known,test_only=legacy.source_versions(Path(folder))
            self.assertEqual(len(known),2)
            self.assertIn("99999999999999999999",test_only)

    def test_guards_run_before_docker_inspection(self):
        with patch.dict(os.environ,{},clear=True),patch.object(legacy,"run") as process:
            with self.assertRaisesRegex(RuntimeError,"QA opt-in"):
                legacy.validate_owner()
            process.assert_not_called()

    def test_only_read_transactions_are_used(self):
        response=subprocess.CompletedProcess([],0,stdout="canvas_development\n20260101000000\n",stderr="")
        with patch.object(legacy,"run",return_value=response) as process:
            self.assertEqual(legacy.read_versions(),["20260101000000"])
            args,kwargs=process.call_args
            self.assertTrue(any("default_transaction_read_only=on" in item for item in args[0]))
            self.assertIn("BEGIN TRANSACTION READ ONLY",kwargs["stdin"])
            self.assertNotIn("COMMIT",kwargs["stdin"])

if __name__=="__main__":
    unittest.main()
