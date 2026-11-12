"""QA-only guard checks; do not contact real users or the network."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

MODULE=Path(__file__).resolve().parents[1]/"authentication_e2e.py"
spec=importlib.util.spec_from_file_location("qa_auth_module",MODULE)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class HeadlessAuthSafetyTests(unittest.TestCase):
    def test_requires_opt_in_before_accessing_docker(self):
        with patch.dict(os.environ,{},clear=True), patch.object(module.subprocess,"run") as execute:
            with self.assertRaisesRegex(RuntimeError,"three explicit"):
                module.verified_canvas()
            execute.assert_not_called()

    def test_rejects_wrong_docker_owner(self):
        labels={"Config":{"Labels":{
            "com.docker.compose.project":"production",
            "com.docker.compose.service":"web",
            "com.docker.compose.project.working_dir":str(module.CANVAS_DIR)
        }},"State":{"Running":True},"NetworkSettings":{"Ports":{"80/tcp":[{"HostPort":"8080"}]}}}
        output=subprocess.CompletedProcess([],0,stdout=json.dumps(labels),stderr="")
        qa_flags={"QA_ALLOW_CANVAS_AUTH_TESTS":"true","PLUGIN_TEST_MODE":"true","PLUGIN_QA_NO_BROWSER":"true"}
        # Recreate only the directory fixture removed during workspace cleanup.
        # Docker remains mocked; project-ownership verification must still reject it.
        with tempfile.TemporaryDirectory(prefix="qa-canvas-owner-") as folder, \
             patch.object(module,"CANVAS_DIR",Path(folder)), \
             patch.dict(os.environ,qa_flags,clear=True), \
             patch.object(module.subprocess,"run",return_value=output):
            with self.assertRaisesRegex(RuntimeError,"owner"):
                module.verified_canvas()

    def test_uses_only_fixture_test_credentials_and_never_reports_them(self):
        with tempfile.TemporaryDirectory(prefix="qa-login-fixture-") as folder:
            fixture=Path(folder)/"clean/Plugin-Feedback-Canvas/.env"
            fixture.parent.mkdir(parents=True)
            fixture.write_text(
                "CANVAS_ADMIN_PASS=synthetic-admin\n"
                "CANVAS_TEACHER_PASS=synthetic-professor\n"
                "CANVAS_STUDENT_PASS=synthetic-student\n"
            )
            with patch.object(module,"QA_ROOT",Path(folder)),patch.dict(os.environ,{},clear=True):
                users=module.synthetic_users()
                self.assertEqual(users["admin"]["name"],"admin@canvas.local")
                self.assertEqual(users["professor"]["password"],"synthetic-professor")
                serialized=json.dumps({key:{"role":key} for key in users})
                self.assertNotIn("synthetic-admin",serialized)

    def test_blocks_non_test_domain_account(self):
        with patch.dict(os.environ,{"QA_ADMIN_USER":"regular-user@example.com"},clear=True):
            with self.assertRaisesRegex(RuntimeError,"Only synthetic"):
                module.synthetic_users()

    def test_headless_suite_report_omits_authentication_values(self):
        output=subprocess.CompletedProcess([],0,stdout='QA_SESSION_CHECKS {"scenario":"reload","checks":{"login_302":true}}\n',stderr="")
        with patch.object(module.subprocess,"run",return_value=output) as execute:
            record=module.run_browser("qa-test","admin","reload","admin@canvas.local",
                                      "synthetic-hidden",Path("/tmp"))
            self.assertEqual(record["status"],"PASS")
            self.assertNotIn("synthetic-hidden",json.dumps(record))
            self.assertIn("QA_LOGIN_PASSWORD",execute.call_args.kwargs["env"])
            self.assertEqual(execute.call_args.args[0][0],"node")

if __name__=="__main__":
    unittest.main()
