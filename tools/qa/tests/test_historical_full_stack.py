"""Safety controls for historical Canvas Rails + PostgreSQL cloned E2E runner."""
import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch
import subprocess
import json

SCRIPT=Path(__file__).resolve().parents[1]/"historical_full_stack.py"
spec=importlib.util.spec_from_file_location("qa_historical_full_stack",SCRIPT)
import sys
sys.path.insert(0,str(SCRIPT.parent))
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class HistoricalCanvasFullStackSafetyTests(unittest.TestCase):
    def test_no_opt_in_is_not_a_docker_request(self):
        with patch.dict(os.environ,{},clear=True):
            with patch.object(module,"safe_run") as call:
                with self.assertRaises(module.QABlocked):
                    module.env_guard()
                call.assert_not_called()

    def test_matching_assertion_name_does_not_create_false_fk(self):
        self.assertFalse(module.exception_fingerprint(
            'QA_SESSION_CHECKS {"login_no_fk":true}')["fkObserved"])
        self.assertFalse(module.exception_fingerprint(
            'GET /login/canvas 500')["fkObserved"])

    def test_actual_fk_signature_requires_constraint_and_terms(self):
        line=("Login::CanvasController#create "
              "ActiveRecord::InvalidForeignKey "
              "PG::ForeignKeyViolation terms_of_services "
              "fk_rails_337ba633a9")
        finding=module.exception_fingerprint(line)
        self.assertTrue(finding["fkObserved"])
        self.assertTrue(finding["fkSignatureMatch"])
        self.assertTrue(finding["loginControllerMatch"])
        self.assertFalse(module.exception_fingerprint(
            "ActiveRecord::InvalidForeignKey in other_table")["fkObserved"])

    def test_pairs_are_strictly_allowlisted(self):
        with self.assertRaisesRegex(module.QABlocked,"allowlisted"):
            module.pair_experiment("canvas-lms-master-production")

    def test_unknown_synthetic_role_blocks_without_docker(self):
        with patch.object(module,"verified_web") as verify:
            with self.assertRaisesRegex(module.QABlocked,"login role"):
                module.pair_experiment("august",role="real-professor")
            verify.assert_not_called()

    def test_web_identity_mismatch_blocks_use_of_historical_clone(self):
        x={
            "Config":{"Labels":{
                "com.docker.compose.project":"different",
                "com.docker.compose.service":"web",
                "com.docker.compose.project.working_dir":"/tmp"
            }, "Env":[]},
            "State":{"Running":False},
            "Mounts":[]
        }
        with patch.object(module,"docker_obj",return_value=x):
            with self.assertRaisesRegex(module.QABlocked,"identity"):
                module.verified_web("august")

    def test_web_running_original_is_never_reused(self):
        label=module.ALLOWED["august"]
        x={
            "Config":{"Labels":{
                "com.docker.compose.project":label["project"],
                "com.docker.compose.service":"web",
                "com.docker.compose.project.working_dir":str(label["source"])
            }, "Env":[]},
            "State":{"Running":True},
            "Mounts":[]
        }
        with patch.object(module,"docker_obj",return_value=x):
            with self.assertRaisesRegex(module.QABlocked,"currently running"):
                module.verified_web("august")

    def test_disposable_owner_label_is_mandatory(self):
        x={"Config":{"Labels":{
            "qa.canvas.pair.owner":"wrong",
            "qa.canvas.pair.disposable":"true"
        }}}
        with patch.object(module,"docker_obj",return_value=x):
            with self.assertRaisesRegex(module.QABlocked,"owner label mismatch"):
                module.checked_owner("qa-hpair-test-web","qa-hpair-expected")

    def test_existing_qa_network_label_check_is_fail_closed(self):
        x={"Labels":{"qa.canvas.pair.owner":"external"}}
        with patch.object(module,"docker_obj",return_value=x):
            self.assertNotEqual(x["Labels"]["qa.canvas.pair.owner"],"qa-hpair-expected")

if __name__=="__main__":
    unittest.main()
