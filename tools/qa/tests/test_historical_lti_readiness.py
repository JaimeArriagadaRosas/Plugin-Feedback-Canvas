"""Fail-closed LTI historical registration prerequisites; never claim a real iframe launch."""
import importlib.util
from pathlib import Path
import os
import unittest
from unittest.mock import patch

SCRIPT=Path(__file__).resolve().parents[1]/"historical_lti_readiness.py"
spec=importlib.util.spec_from_file_location("qa_historical_lti_readiness",SCRIPT)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def record(*,registered=0,complete=True,clean=True):
    return {"result":{
      "originalModified":False,"cleanupConfirmed":clean,
      "status":"PASS" if complete else "BLOCKED",
      "catalog":{"accounts":complete,"terms":complete,"shards":complete,"migrations":complete},
      "ltiMetadata":{
        "status":"CONFIG_CANDIDATE" if registered else "REGISTRATION_REVIEW",
        "tools":1,"publicTools":1,"toolsForLocalQaBackend":1,
        "toolsMatchingCurrentQaClient":registered,
        "actualLtiLaunchConfirmed":False
      }}}

class HistoricalLtiPreflightTests(unittest.TestCase):
    def test_requires_explicit_opt_in_without_issuing_network(self):
        with patch.dict(os.environ,{},clear=True),patch.object(mod,"urlopen") as http:
            with self.assertRaisesRegex(RuntimeError,"opt-in"):
                mod.backend_http_probe()
            http.assert_not_called()

    def test_registration_is_not_launch(self):
        summary=mod.build(lambda name:record(registered=1),True)
        self.assertTrue(summary["allToolAndClientRegistrationsReady"])
        self.assertFalse(summary["actualLtiLaunchVerified"])
        self.assertEqual(summary["status"],"PREREQUISITE_REVIEW")

    def test_unmatched_client_is_review_not_proof_of_lti_failure(self):
        result=mod.classify("august",record(registered=0))
        self.assertEqual(result["status"],"REGISTRATION_REVIEW")
        self.assertFalse(result["launchVerified"])

    def test_incomplete_historical_schema_is_blocked(self):
        result=mod.classify("october-alternate-db",record(complete=False))
        self.assertEqual(result["status"],"SCHEMA_BLOCKED")
        self.assertFalse(result["launchVerified"])

    def test_unconfirmed_cleanup_does_not_claim_success(self):
        result=mod.classify("october",record(registered=1,clean=False))
        self.assertEqual(result["status"],"FAIL")

    def test_absent_registration_report_is_not_a_success(self):
        self.assertEqual(mod.classify("august",None)["status"],"NOT_RUN")

    def test_lti_backend_unavailable_prevents_claim_of_e2e(self):
        report=mod.build(lambda name:record(registered=0),False)
        self.assertFalse(report["backendHttpsLocalHealthReachable"])
        self.assertFalse(report["actualLtiLaunchVerified"])

if __name__=="__main__":
    unittest.main()
