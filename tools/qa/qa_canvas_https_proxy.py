"""Disposable localhost HTTPS ingress for a copied Canvas Rails app.

Never starts Docker or alters historical Canvas configuration. The proxy is
bound to 127.0.0.1:8443 only and never logs URLs, headers, cookies or JWTs.
"""
from contextlib import contextmanager
from http.client import HTTPConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import os
import re
import ssl
from threading import Thread

ROOT=Path(__file__).resolve().parents[2]

class ProxyBlocked(Exception):
    pass

def allowed_upstream(url):
    match=re.fullmatch(r"http://127\.0\.0\.1:([1-9][0-9]{3,4})",url)
    if not match:raise ProxyBlocked("Only an ephemeral local Canvas source is authorized")
    port=int(match.group(1))
    if port==8443 or port>=65536:
        raise ProxyBlocked("Unexpected QA Canvas upstream port")
    return port

def make_handler(upstream_port):
    class Proxy(BaseHTTPRequestHandler):
        protocol_version="HTTP/1.1"
        def log_message(self,*args):
            return
        def respond(self):
            # No body/logging fields are retained or written to disk.
            length=int(self.headers.get("Content-Length") or "0")
            if length>4*1024*1024:
                self.send_error(413)
                return
            body=self.rfile.read(length) if length else None
            headers={k:v for k,v in self.headers.items()
                     if k.lower() not in ("connection","proxy-connection","keep-alive",
                       "transfer-encoding","upgrade","host","content-length")}
            headers.update({"Host":"localhost:8443",
                            "X-Forwarded-Proto":"https",
                            "X-Forwarded-Host":"localhost:8443",
                            "X-Forwarded-Port":"8443",
                            "Connection":"close"})
            if body is not None:headers["Content-Length"]=str(len(body))
            headers_sent=False
            try:
                conn=HTTPConnection("127.0.0.1",upstream_port,timeout=45)
                conn.request(self.command,self.path,body=body,headers=headers)
                result=conn.getresponse()
                self.send_response_only(result.status,result.reason)
                excluded={"connection","transfer-encoding","keep-alive","proxy-connection"}
                for key,value in result.getheaders():
                    if key.lower() not in excluded:
                        self.send_header(key,value)
                self.send_header("Connection","close")
                self.end_headers()
                headers_sent=True
                while True:
                    part=result.read(256*1024)
                    if not part:break
                    self.wfile.write(part)
                conn.close()
            except (OSError,ValueError):
                # A browser may terminate during navigation. Never write a second
                # response after headers were already sent, and never log JWTs.
                if not headers_sent:
                    try:
                        self.send_response_only(502)
                        self.send_header("Content-Length","0")
                        self.send_header("Connection","close")
                        self.end_headers()
                    except OSError:
                        pass
            self.close_connection=True
        do_GET=respond
        do_POST=respond
        do_HEAD=respond
        do_OPTIONS=respond
        do_PUT=respond
        do_DELETE=respond
    return Proxy

@contextmanager
def qa_canvas_https(url):
    for key in ("QA_ALLOW_FULL_LTI_E2E","PLUGIN_TEST_MODE","PLUGIN_QA_NO_BROWSER"):
        if os.environ.get(key)!="true":raise ProxyBlocked("Explicit headless QA authorization required")
    port=allowed_upstream(url)
    cert=ROOT/"apps/server/certs/localhost.pem"
    key=ROOT/"apps/server/certs/localhost-key.pem"
    if not cert.is_file() or not key.is_file():
        raise ProxyBlocked("Existing localhost TLS certificate missing")
    try:
        server=ThreadingHTTPServer(("127.0.0.1",8443),make_handler(port))
    except OSError as exc:
        raise ProxyBlocked("HTTPS localhost:8443 already occupied; existing service not touched") from exc
    thread=None
    try:
        context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        context.load_cert_chain(certfile=str(cert),keyfile=str(key))
        server.socket=context.wrap_socket(server.socket,server_side=True)
        thread=Thread(target=server.serve_forever,daemon=True,name="qa-canvas-localhost-https")
        thread.start()
        yield "https://localhost:8443"
    finally:
        if thread is not None:
            server.shutdown()
            thread.join(timeout=8)
        server.server_close()
