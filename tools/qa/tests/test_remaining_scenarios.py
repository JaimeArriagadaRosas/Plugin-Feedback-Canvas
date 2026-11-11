"""The remaining-scenarios runner is explicitly opt-in and does not promise repair."""
import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch

src=Path(__file__).resolve().parents[1]/"remaining_scenarios.py"
spec=importlib.util.spec_from_file_location("remaining_scenarios_qa",src)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class RemainingScenarioSafetyTests(unittest.TestCase):
    def test_no_qa_opt_in_blocks_before_actions(self):
        with patch.dict(os.environ,{},clear=True), patch.object(module.subprocess,"run") as execute:
            with self.assertRaisesRegex(RuntimeError,"no-browser flags"):
                module.verified_flags()
            execute.assert_not_called()

    def test_child_exec_can_time_out_without_fake_success(self):
        with patch.object(module.subprocess,"run",side_effect=module.subprocess.TimeoutExpired("node",1)):
            status,output=module.execute("never-run",["node","script"],{},1)
            self.assertEqual(status,124)
            self.assertEqual(output,"")

if __name__=="__main__":
    unittest.main()
