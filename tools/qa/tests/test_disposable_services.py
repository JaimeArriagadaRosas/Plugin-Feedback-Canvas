"""No permissions to touch user Docker state are ever implied by QA tests."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch

MODULE = Path(__file__).resolve().parents[1] / "disposable_services.py"
spec = importlib.util.spec_from_file_location("disposable_services", MODULE)
disposable = importlib.util.module_from_spec(spec)
spec.loader.exec_module(disposable)

QA = {
    "QA_ALLOW_DISPOSABLE_COMPAT_TESTS": "true",
    "PLUGIN_TEST_MODE": "true",
    "PLUGIN_QA_NO_BROWSER": "true"
}

class DisposableSafetyTests(unittest.TestCase):
    def test_fails_closed_without_double_headless_opt_in(self):
        for key in QA:
            flags = {k:v for k,v in QA.items() if k != key}
            with self.subTest(absent=key), patch.dict(os.environ,flags,clear=True):
                with self.assertRaises(disposable.QAFailed):
                    disposable.DisposableLab()

    def test_rejects_non_random_or_historical_project_ids(self):
        with patch.dict(os.environ,QA,clear=True):
            for name in ["main", "canvas-lms-master", "qa-feedback-20261110",
                         "qa-compat-fixed", "qa-compat-1234"]:
                with self.subTest(name=name), self.assertRaises(disposable.QAFailed):
                    disposable.DisposableLab(project=name)

    def test_rejects_non_allowlisted_service_operations(self):
        with patch.dict(os.environ,QA,clear=True):
            lab=disposable.DisposableLab(project="qa-compat-1234abcd")
            with self.assertRaises(disposable.QAFailed):
                lab.container("canvas-web")

    def test_does_not_reuse_a_preexisting_compose_project(self):
        with patch.dict(os.environ,QA,clear=True):
            lab=disposable.DisposableLab(project="qa-compat-1234abcd")
            existing=subprocess.CompletedProcess([],0,stdout="some-container-id\n",stderr="")
            with patch.object(disposable,"call",return_value=existing) as call:
                with self.assertRaisesRegex(disposable.QAFailed,"Ya existe"):
                    lab.start()
                self.assertEqual(call.call_count,1)
                self.assertFalse(lab.active)

    def test_denies_stop_if_container_labels_differ(self):
        with patch.dict(os.environ,QA,clear=True):
            lab=disposable.DisposableLab(project="qa-compat-1234abcd")
            foreign={"Config":{"Labels":{"com.docker.compose.project":"other",
                                         "com.docker.compose.service":"db"}}}
            result=subprocess.CompletedProcess([],0,stdout=json.dumps(foreign),stderr="")
            with patch.object(disposable,"call",return_value=result) as call:
                with self.assertRaises(disposable.QAFailed):
                    lab.stop("db")
                self.assertEqual(call.call_count,1)

    def test_cleanup_not_attempted_on_unowned_not_started_project(self):
        with patch.dict(os.environ,QA,clear=True):
            lab=disposable.DisposableLab(project="qa-compat-1234abcd")
            with patch.object(disposable,"call") as call:
                self.assertTrue(lab.cleanup())
                call.assert_not_called()

if __name__=="__main__":
    unittest.main()
