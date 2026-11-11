"""Sanitized offline regression fixtures remain usable after old clones are deleted."""
import importlib.util
import json
from pathlib import Path
import unittest

root=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("historical_matrix_fixture",root/"historical_matrix.py")
matrix=importlib.util.module_from_spec(spec)
spec.loader.exec_module(matrix)
fixtures=root/"fixtures/historical_schema_shapes.json"

class HistoricalShapeFixtureTests(unittest.TestCase):
    def test_all_sanitized_structural_classes(self):
        d=json.loads(fixtures.read_text())
        self.assertNotIn("password",json.dumps(d).lower())
        self.assertNotIn("token",json.dumps(d).lower())
        self.assertEqual(len(d["fixtures"]),4)
        for fixture in d["fixtures"]:
            with self.subTest(name=fixture["name"]):
                record=matrix.classified_db(fixture["name"],fixture["record"])
                self.assertEqual(record["status"],fixture["expected"])

if __name__=="__main__":unittest.main()
