"""Isolated Plugin Feedback backend safety invariants and output classification."""
import importlib.util
import os
from pathlib import Path
import socket
import subprocess
import unittest
from unittest.mock import patch
import sys

HERE=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(HERE))
src=HERE/"isolated_plugin_backend.py"
spec=importlib.util.spec_from_file_location("qa_disposable_plugin",src)
backend=importlib.util.module_from_spec(spec)
spec.loader.exec_module(backend)
runner_src=HERE/"isolated_lti_full_launch.py"
spec2=importlib.util.spec_from_file_location("qa_disposable_lti",runner_src)
runner=importlib.util.module_from_spec(spec2)
spec2.loader.exec_module(runner)

class IsolatedBackendTests(unittest.TestCase):
    def test_missing_opt_in_blocks_without_docker(self):
        with patch.dict(os.environ,{},clear=True),patch.object(backend,"run") as process:
            with self.assertRaisesRegex(backend.SafeAbort,"QA flags"):
                backend.guard()
            process.assert_not_called()

    def test_occupied_port_blocks_before_docker(self):
        with socket.socket(socket.AF_INET,socket.SOCK_STREAM) as sock:
            sock.bind(("127.0.0.1",0))
            sock.listen(1)
            self.assertTrue(backend.tcp_bound(sock.getsockname()[1]))

    def test_ephemeral_env_never_reuses_qa_database(self):
        with patch.object(backend,"read_qa_env",return_value={
            "DB_HOST":"production.example.com","DATABASE_URL":"postgresql://production",
            "DB_PASSWORD":"oldsecret","LTI_CLIENT_ID":"777",
            "CANVAS_BASE_URL":"https://localhost:8443"
        }):
            values=backend.backend_env(42321,"new_test_only_secret","qa_lti_fixture",
                  canvas_url="http://127.0.0.1:34567",client_id="2")
        self.assertEqual(values["DB_HOST"],"127.0.0.1")
        self.assertEqual(values["DB_PORT"],"42321")
        self.assertEqual(values["DB_NAME"],"qa_lti_fixture")
        self.assertEqual(values["DB_PASSWORD"],"new_test_only_secret")
        self.assertNotIn("DATABASE_URL",values)
        self.assertEqual(values["LTI_CLIENT_ID"],"2")
        self.assertEqual(values["CANVAS_BASE_URL"],"http://127.0.0.1:34567")
        self.assertEqual(values["USE_LOCAL_DATA"],"false")
        self.assertEqual(values["LOG_TO_FILE"],"false")
        self.assertRegex(values["ENCRYPTION_KEY"],r"^[0-9a-f]{64}$")

    def test_oauth_credentials_and_canvas_api_use_disposable_copy_only(self):
        with patch.object(backend,"read_qa_env",return_value={"CANVAS_INTERNAL_URL":"http://127.0.0.1:8080"}):
            values=backend.backend_env(42321,"test_db_password","qa_lti_fixture",
                canvas_url="https://localhost:8443",client_id="2",
                client_secret="synthetic_only_secret_123",
                canvas_internal_url="http://127.0.0.1:38765")
        self.assertEqual(values["CANVAS_INTERNAL_URL"],"http://127.0.0.1:38765")
        self.assertEqual(values["CANVAS_CLIENT_ID"],"2")
        self.assertEqual(values["CANVAS_CLIENT_SECRET"],"synthetic_only_secret_123")
        self.assertEqual(values["LTI_CLIENT_SECRET"],"synthetic_only_secret_123")
        with patch.object(backend,"read_qa_env",return_value={}):
            for url in ("http://127.0.0.1:8080", "https://remote.example:9000",
                        "http://127.0.0.1:38765/courses/1", "http://localhost:38765"):
                with self.subTest(url=url), self.assertRaises(backend.SafeAbort):
                    backend.backend_env(42321,"test_db_password","qa_lti_fixture",
                        canvas_internal_url=url)
            with self.assertRaises(backend.SafeAbort):
                backend.backend_env(42321,"test_db_password","qa_lti_fixture",client_secret="short")

    def test_rejects_remote_canvas_and_invalid_lti_client(self):
        with patch.object(backend,"read_qa_env",return_value={}):
            for url in ("https://example.com","http://example.com:8080","file:///tmp/secret"):
                with self.subTest(url=url),self.assertRaises(backend.SafeAbort):
                    backend.backend_env(55555,"secret","qa_lti_test",canvas_url=url)
            with self.assertRaises(backend.SafeAbort):
                backend.backend_env(55555,"secret","qa_lti_test",client_id="1; DROP TABLE x")

    def test_backend_log_capture_discards_raw_urls_tokens_and_identities(self):
        line=(b'[ERROR-PROG] TypeError: Cannot read properties of undefined '
              b'https://localhost:3000/callback?code=TOP_SECRET&state=HIDDEN')
        categories=backend.classify_backend_log_line(line)
        self.assertEqual(categories,{'runtime_programming_error','type_error','missing_property'})
        for secret in ('TOP_SECRET','HIDDEN','localhost','undefined'):
            self.assertNotIn(secret,repr(categories))

    def test_stack_location_diagnostic_never_copies_authentication_values(self):
        line=(b'error at CanvasOAuth.callback (file:///home/jaime/projects/'
              b'apps/server/src/controllers/CanvasOAuthController.js:110:3) '
              b'code=SECRET_USER_TOKEN')
        frames=backend.safe_backend_stack_frames(line)
        self.assertEqual(frames,{'apps/server/src/controllers/CanvasOAuthController.js:110'})
        self.assertNotIn('SECRET_USER_TOKEN',repr(frames))
        self.assertEqual(backend.safe_backend_stack_frames(
            b'apps/server/src/../../secrets.js:13:3'),set())

    def test_qa_volume_cleanup_requires_exact_owner(self):
        mock=subprocess.CompletedProcess([],0,stdout='{"Config":{"Labels":{"qa.plugin.owner":"wrong","qa.plugin.disposable":"true"}}}',stderr="")
        with patch.object(backend,"run",return_value=mock):
            with self.assertRaisesRegex(backend.SafeAbort,"does not belong"):
                backend.labels_ok("another-volume","ours")

class FullLtiTests(unittest.TestCase):
    def test_explicit_flags_required(self):
        with patch.dict(os.environ,{},clear=True):
            with self.assertRaisesRegex(runner.SafeAbort,"QA"):
                runner.explicit_authorization()

    def test_only_disposable_canvas_container_accepted(self):
        with self.assertRaisesRegex(runner.SafeAbort,"ephemeral Canvas"):
            runner.lti_client_from_copied_canvas("canvas-lms-master-postgres-1")

    def test_only_one_active_feedback_client_accepted(self):
        completed=subprocess.CompletedProcess([],0,stdout="2\n3\n",stderr="")
        with patch.object(runner.subprocess,"run",return_value=completed):
            with self.assertRaisesRegex(runner.SafeAbort,"Exactly one"):
                runner.lti_client_from_copied_canvas("qa-hpair-012abc-db")

    def test_dev_key_secret_uses_readonly_disposable_lookup_and_hex_transport(self):
        secret="test_disposable_oauth_secret"
        completed=subprocess.CompletedProcess([],0,stdout=secret.encode().hex()+"\n",stderr="")
        with patch.object(runner.subprocess,"run",return_value=completed) as query:
            actual=runner.lti_secret_from_copied_canvas("qa-hpair-012abc-db","2")
        self.assertEqual(actual,secret)
        kwargs=query.call_args.kwargs
        self.assertIn("BEGIN TRANSACTION READ ONLY",kwargs['input'])
        self.assertIn("PGOPTIONS=-c default_transaction_read_only=on",query.call_args.args[0])
        self.assertNotIn(secret,repr(kwargs))
        self.assertIn("id=2",kwargs['input'])
        with self.assertRaises(runner.SafeAbort):
            runner.lti_secret_from_copied_canvas("canvas-lms-master-postgres-1","2")
        with self.assertRaises(runner.SafeAbort):
            runner.lti_secret_from_copied_canvas("qa-hpair-012abc-db","2; SELECT 1")

    def test_no_browser_success_claimed_on_missing_report(self):
        completed=subprocess.CompletedProcess([],1,stdout="unverified",stderr="")
        with patch.object(runner.subprocess,"run",return_value=completed):
            output=runner.browser_check("http://127.0.0.1:34567","test@canvas.local","fixture")
        self.assertEqual(output["status"],"FAILED_NO_REPORT")
        self.assertFalse(output["browserPassed"])

    def test_lti_success_requires_courses_and_oauth_per_selected_role(self):
        good={"status":"PASS","pluginUiVisible":True,"feedbackTabVisible":True,
              "oauthCallbackSucceeded":True,"courseApiSucceeded":True,
              "coursesHttpAfterOauthStatuses":[200]}
        admin={**good,"role":"admin"}
        professor={**good,"role":"professor"}
        self.assertTrue(runner.role_cases_confirmed([admin],"admin"))
        self.assertTrue(runner.role_cases_confirmed([admin,professor],"both"))
        self.assertFalse(runner.role_cases_confirmed([admin],"both"))
        self.assertFalse(runner.role_cases_confirmed([professor],"admin"))
        self.assertFalse(runner.role_cases_confirmed([admin,{**professor,"courseApiSucceeded":False}],"both"))
        self.assertFalse(runner.role_cases_confirmed([{**admin,"oauthCallbackSucceeded":False}],"admin"))
        with self.assertRaises(runner.SafeAbort):
            runner.role_cases_confirmed([admin],"other")

if __name__=="__main__":
    unittest.main()
