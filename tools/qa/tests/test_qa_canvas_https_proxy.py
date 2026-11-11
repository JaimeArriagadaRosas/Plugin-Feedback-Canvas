"""Secure, local-only HTTPS bridge prerequisites for disposable Canvas QA."""
import importlib.util
import os
from pathlib import Path
from unittest.mock import patch
import unittest
import sys

SCRIPT=Path(__file__).resolve().parents[1]/"qa_canvas_https_proxy.py"
spec=importlib.util.spec_from_file_location("qa_https_bridge",SCRIPT)
proxy=importlib.util.module_from_spec(spec)
spec.loader.exec_module(proxy)

class ProxyGuardTests(unittest.TestCase):
    def test_local_only_upstream(self):
        self.assertEqual(proxy.allowed_upstream("http://127.0.0.1:32768"),32768)
        for invalid in ("http://localhost:80","https://example.com:34567",
                        "http://127.0.0.1:8443","http://127.0.0.1:8080/a",
                        "http://127.0.0.1:8080?q=token"):
            with self.subTest(invalid=invalid),self.assertRaises(proxy.ProxyBlocked):
                proxy.allowed_upstream(invalid)

    def test_optin_guard_does_not_bind_port(self):
        with patch.dict(os.environ,{},clear=True),patch.object(proxy,"ThreadingHTTPServer") as server:
            with self.assertRaisesRegex(proxy.ProxyBlocked,"authorization"):
                with proxy.qa_canvas_https("http://127.0.0.1:32768"):
                    pass
            server.assert_not_called()

    def test_proxy_handler_is_silent_even_on_callback(self):
        cls=proxy.make_handler(32768)
        self.assertEqual(cls.protocol_version,"HTTP/1.1")
        self.assertEqual(cls.log_message(cls,"%s","/api/lti/callback?jwt=hidden"),None)

if __name__=="__main__":unittest.main()
