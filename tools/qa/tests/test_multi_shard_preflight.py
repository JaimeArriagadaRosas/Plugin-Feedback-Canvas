"""Multi-shard prerequisites must never be confused with a valid Rails login."""
import importlib.util
from pathlib import Path
import unittest
import sys
from unittest.mock import patch
import subprocess

src=Path(__file__).resolve().parents[1]/"multi_shard_preflight.py"
sys.path.insert(0,str(src.parent))
spec=importlib.util.spec_from_file_location("qa_multi_shard_preflight",src)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ShardPreflightTests(unittest.TestCase):
    def test_one_real_shard_means_not_supported(self):
        r=module.classify_shards([1])
        self.assertEqual(r["scenarioStatus"],"SKIPPED")
        self.assertEqual(r["suspectedGlobalShardSegment"],10)
        self.assertFalse(r["suspectedShardRegistered"])

    def test_shard_ten_configured_allows_manual_verification_not_fake_pass(self):
        r=module.classify_shards([1,10])
        self.assertEqual(r["scenarioStatus"],"READY_FOR_MANUAL_E2E")
        self.assertFalse(r["scenarioStatus"]=="PASS")

    def test_readonly_query_only(self):
        proc=subprocess.CompletedProcess([],0,stdout="canvas_development\n1\n",stderr="")
        with patch.object(module,"run",return_value=proc) as execute:
            self.assertEqual(module.read_shards(),[1])
            self.assertIn("BEGIN TRANSACTION READ ONLY",execute.call_args.kwargs["stdin"])
            self.assertIn("default_transaction_read_only=on"," ".join(execute.call_args.args[0]))

    def test_query_rejects_wrong_database(self):
        proc=subprocess.CompletedProcess([],0,stdout="production\n1\n",stderr="")
        with patch.object(module,"run",return_value=proc):
            with self.assertRaisesRegex(RuntimeError,"database identity"):
                module.read_shards()

if __name__=="__main__":
    unittest.main()
