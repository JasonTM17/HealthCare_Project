from __future__ import annotations

import hashlib
import http.client
import socketserver
import struct
import threading
import unittest
from contextlib import contextmanager

import scanner


TEST_TOKEN = "scanner-test-token-32-characters-minimum"


class _ClamdHandler(socketserver.BaseRequestHandler):
    response = b"stream: OK\0"

    def handle(self) -> None:
        command = self.request.recv(10)
        if command == b"zPING\0":
            self.request.sendall(b"PONG\0")
            return
        if command != b"zINSTREAM\0":
            self.request.sendall(b"UNKNOWN COMMAND\0")
            return
        while True:
            size = struct.unpack("!I", self._read_exact(4))[0]
            if size == 0:
                break
            self._read_exact(size)
        self.request.sendall(self.response)

    def _read_exact(self, size: int) -> bytes:
        output = bytearray()
        while len(output) < size:
            chunk = self.request.recv(size - len(output))
            if not chunk:
                raise ConnectionError("unexpected EOF")
            output.extend(chunk)
        return bytes(output)


class _ThreadedTcpServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


@contextmanager
def clamd_server(response: bytes = b"stream: OK\0"):
    handler = type("ConfiguredClamdHandler", (_ClamdHandler,), {"response": response})
    server = _ThreadedTcpServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server.server_address
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


@contextmanager
def http_server(clamd_address: tuple[str, int]):
    server = scanner.ScannerServer(
        ("127.0.0.1", 0),
        TEST_TOKEN,
        clamd_address[0],
        clamd_address[1],
        scanner.DEFAULT_MAX_SCAN_BYTES,
    )
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield server.server_address[1]
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def scan_post(port: int, payload: bytes, declared_hash: str | None = None, token: str = TEST_TOKEN):
    """POST one scan to the loopback fixture with an explicit host pin.

    http.client with a literal "127.0.0.1" host (and the port the fixture
    bound) keeps the request target provably local: no URL parsing, no
    redirects, no way to repoint the suite at an internal or metadata host.
    """
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=2)
    try:
        connection.request(
            "POST",
            "/scan",
            body=payload,
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/octet-stream",
                "X-Content-SHA256": declared_hash or hashlib.sha256(payload).hexdigest(),
            },
        )
        response = connection.getresponse()
        return response.status, dict(response.getheaders()), response.read()
    finally:
        connection.close()


def scan_get(port: int, path: str):
    connection = http.client.HTTPConnection("127.0.0.1", port, timeout=2)
    try:
        connection.request("GET", path)
        response = connection.getresponse()
        return response.status, response.read()
    finally:
        connection.close()


class ScannerContractTest(unittest.TestCase):
    def test_clean_payload_requires_authentication_and_hash_then_returns_clean(self) -> None:
        payload = b"synthetic-clean-file"
        with clamd_server() as clamd, http_server(clamd) as port:
            status, headers, body = scan_post(port, payload)
            self.assertEqual(200, status)
            self.assertEqual(b"CLEAN", body)
            self.assertEqual("no-store", headers.get("Cache-Control"))

            wrong_token_status, _, _ = scan_post(port, payload, token="wrong")
            self.assertEqual(401, wrong_token_status)

    def test_infected_clamd_verdict_never_becomes_clean(self) -> None:
        with clamd_server(b"stream: Eicar-Signature FOUND\0") as clamd, http_server(clamd) as port:
            _, _, body = scan_post(port, b"synthetic-eicar")
            self.assertEqual(b"MALWARE", body)

    def test_malformed_not_ok_verdict_fails_closed(self) -> None:
        with clamd_server(b"stream: NOT OK\0") as clamd, http_server(clamd) as port:
            status, _, body = scan_post(port, b"synthetic-malformed")
            self.assertEqual(503, status)
            self.assertEqual(b"UNAVAILABLE", body)

    def test_hash_mismatch_fails_before_scan(self) -> None:
        with clamd_server() as clamd, http_server(clamd) as port:
            status, _, body = scan_post(
                port,
                b"mutated",
                declared_hash=hashlib.sha256(b"expected").hexdigest(),
            )
            self.assertEqual(400, status)
            self.assertEqual(b"HASH_MISMATCH", body)

    def test_ready_probe_checks_clamd(self) -> None:
        with clamd_server() as clamd, http_server(clamd) as port:
            status, body = scan_get(port, "/readyz")
            self.assertEqual(200, status)
            self.assertEqual(b"READY", body)


if __name__ == "__main__":
    unittest.main()
