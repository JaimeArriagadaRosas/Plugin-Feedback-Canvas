"""Safety regression: old projects and volumes are never modified by QA runner."""
import importlib.util
from pathlib import Path
from tempfile import TemporaryDirectory
import io
import os
import subprocess
import tarfile
import unittest
from unittest.mock import patch

SRC = Path(__file__).resolve().parents[1]/"historical_compatibility_lab.py"
spec = importlib.util.spec_from_file_location("qa_historical_lab",SRC)
historical = importlib.util.module_from_spec(spec)
spec.loader.exec_module(historical)

def archive_blob(entries):
    data=io.BytesIO()
    with tarfile.open(fileobj=data,mode="w") as tf:
        for name,content in entries:
            entry=tarfile.TarInfo(name)
            entry.size=len(content)
            tf.addfile(entry,io.BytesIO(content))
    return data.getvalue()

class HistoricalSafetyTests(unittest.TestCase):
    def test_requires_triple_opt_in_before_writes_or_docker(self):
        with patch.dict(os.environ,{},clear=True),patch.object(historical,"command") as runner:
            with self.assertRaisesRegex(historical.QABlocked,"Explicit"):
                historical.require_qa()
            runner.assert_not_called()

    def test_source_allowlist_prevents_unknown_clones(self):
        with self.assertRaises(historical.QABlocked):
            historical.build_source("english-version")

    def test_volume_allowlist_prevents_unknown_containers(self):
        with self.assertRaises(historical.QABlocked):
            historical.clone_pg("qa-feedback-20261110-postgres-1")

    def test_tar_avoids_secrets_and_writes_only_under_sandbox(self):
        with TemporaryDirectory() as temp:
            blob=archive_blob([
                ("package.json",b'{"scripts":{"build":"vite build"}}'),
                (".env",b"secret-test-fixture"),
                ("node_modules/fake",b"secret-other"),
                ("src/main.js",b"export default 1")
            ])
            count=historical.safe_archive(blob,Path(temp))
            self.assertEqual(count,2)
            self.assertFalse((Path(temp)/".env").exists())
            self.assertFalse((Path(temp)/"node_modules").exists())
            self.assertEqual((Path(temp)/"src/main.js").read_text(),"export default 1")

    def test_tar_blocks_traversal_and_symlinks(self):
        with TemporaryDirectory() as temp:
            with self.assertRaisesRegex(historical.QABlocked,"Unsafe"):
                historical.safe_archive(archive_blob([("../outside",b"risk")]),Path(temp))
            with self.assertRaisesRegex(historical.QABlocked,"Unsafe"):
                historical.safe_archive(archive_blob([("/tmp/outside",b"risk")]),Path(temp))
            data=io.BytesIO()
            with tarfile.open(fileobj=data,mode="w") as tf:
                entry=tarfile.TarInfo("link")
                entry.type=tarfile.SYMTYPE
                entry.linkname="../../outside"
                tf.addfile(entry)
            with self.assertRaisesRegex(historical.QABlocked,"link"):
                historical.safe_archive(data.getvalue(),Path(temp))

    def test_readonly_historical_volume_version_uses_docker_readonly_mount(self):
        result=subprocess.CompletedProcess([],0,stdout=b"14\n",stderr=b"")
        with patch.object(historical,"command",return_value=result) as call:
            value=historical.pg_major({"volume":"anonymous-historical"})
        self.assertEqual(value,"14")
        arguments=call.call_args.args[0]
        self.assertIn("--read-only",arguments)
        self.assertIn("--network",arguments)
        self.assertTrue(any("readonly" in arg and "anonymous-historical" in arg for arg in arguments))

    def test_container_label_mismatch_prevents_any_copy(self):
        wrong={
          "Config":{"Labels":{"com.docker.compose.project":"production",
                              "com.docker.compose.service":"postgres",
                              "com.docker.compose.project.working_dir":"/tmp"}},
          "State":{"Running":False,"Status":"exited"},
          "Mounts":[{"Type":"volume","Destination":"/var/lib/postgresql/data","Name":"fixture"}]
        }
        import json
        response=subprocess.CompletedProcess([],0,stdout=json.dumps(wrong).encode(),stderr=b"")
        with patch.object(historical,"command",return_value=response) as command:
            with self.assertRaisesRegex(historical.QABlocked,"identity"):
                historical.inspected_pg("august-canvas-db")
            self.assertEqual(command.call_count,1)

    def test_refuses_postgres_major_mismatch(self):
        outcome=subprocess.CompletedProcess([],0,stdout=b"postgres (PostgreSQL) 15.14",stderr=b"")
        with patch.object(historical,"command",return_value=outcome):
            with self.assertRaisesRegex(historical.QABlocked,"does not match"):
                historical.matching_image({"image":"fixture-image"},"14")

    def test_failed_copy_cleans_only_its_new_disposable_volume(self):
        volume_name = "old-immutable-volume"
        commands = []
        def call(argv, **kwargs):
            commands.append(argv)
            import subprocess
            if argv[0:3] == ["docker","volume","create"]:
                name=argv[-1]
                return subprocess.CompletedProcess(argv,0,stdout=name.encode(),stderr=b"")
            if argv[0:3] == ["docker","run","--rm"]:
                return subprocess.CompletedProcess(argv,1,stdout=b"",stderr=b"simulated-copy-failure")
            if argv[0:3] == ["docker","volume","rm"]:
                return subprocess.CompletedProcess(argv,0,stdout=b"",stderr=b"")
            if argv[0:3] == ["docker","volume","inspect"]:
                return subprocess.CompletedProcess(argv,1,stdout=b"",stderr=b"not-found")
            raise AssertionError("Unexpected Docker command: "+str(argv))
        owned={"Config":{"Labels":{"qa.historical.owner":"from_this_run"}}}
        from unittest.mock import patch
        with (patch.object(historical,"inspected_pg",return_value={
             "container":"old-postgres","volume":volume_name,"image":"postgres:14-alpine"}),
             patch.object(historical,"pg_major",return_value="14"),
             patch.object(historical,"matching_image",return_value="postgres:14-alpine"),
             patch.object(historical,"command",side_effect=call),
             patch.object(historical,"docker_metadata") as metadata):
            def volume_metadata(_kind,_name):
                # Mirror exact owner from the generated name.
                return {"Labels":{"qa.historical.owner":_name.removesuffix("-data"),
                                  "qa.historical.disposable":"true"}}
            metadata.side_effect=volume_metadata
            record=historical.clone_pg("august-canvas-db")
        self.assertEqual(record["status"],"BLOCKED")
        self.assertTrue(record["cleanupConfirmed"])
        self.assertFalse(any(argv[:2]==["docker","start"] for argv in commands))
        self.assertFalse(any(argv[:3]==["docker","volume","rm"] and
                             argv[-1]==volume_name for argv in commands))
        self.assertTrue(any(argv[:3]==["docker","volume","rm"] and
                            argv[-1].startswith(historical.PREFIX) for argv in commands))

    def test_volume_cleanup_uses_only_disposable_labels(self):
        self.assertEqual(historical.PREFIX,"qa-historical-")
        self.assertTrue(all(x.startswith("october") or x.startswith("august")
                            for x in historical.PG_SOURCES))

if __name__=="__main__":unittest.main()
