from __future__ import annotations

import hashlib
import socketserver
import struct
import threading
import unittest
import urllib.error
import urllib.request
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
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)


def scan_request(base_url: str, payload: bytes, token: str = TEST_TOKEN):
    return urllib.request.Request(
        f"{base_url}/scan",
        data=payload,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/octet-stream",
            "X-Content-SHA256": hashlib.sha256(payload).hexdigest(),
        },
    )


class ScannerContractTest(unittest.TestCase):
    def test_clean_payload_requires_authentication_and_hash_then_returns_clean(self) -> None:
        payload = b"synthetic-clean-file"
        with clamd_server() as clamd, http_server(clamd) as base_url:
            with urllib.request.urlopen(scan_request(base_url, payload), timeout=2) as response:
                self.assertEqual(200, response.status)
                self.assertEqual(b"CLEAN", response.read())
                self.assertEqual("no-store", response.headers["Cache-Control"])

            with self.assertRaises(urllib.error.HTTPError) as unauthenticated:
                urllib.request.urlopen(scan_request(base_url, payload, "wrong"), timeout=2)
            self.assertEqual(401, unauthenticated.exception.code)
            unauthenticated.exception.close()

    def test_infected_clamd_verdict_never_becomes_clean(self) -> None:
        with clamd_server(b"stream: Eicar-Signature FOUND\0") as clamd, http_server(clamd) as base_url:
            with urllib.request.urlopen(scan_request(base_url, b"synthetic-eicar"), timeout=2) as response:
                self.assertEqual(b"MALWARE", response.read())

    def test_malformed_not_ok_verdict_fails_closed(self) -> None:
        with clamd_server(b"stream: NOT OK\0") as clamd, http_server(clamd) as base_url:
            with self.assertRaises(urllib.error.HTTPError) as malformed:
                urllib.request.urlopen(scan_request(base_url, b"synthetic-malformed"), timeout=2)
            self.assertEqual(503, malformed.exception.code)
            self.assertEqual(b"UNAVAILABLE", malformed.exception.read())
            malformed.exception.close()

    def test_hash_mismatch_fails_before_scan(self) -> None:
        with clamd_server() as clamd, http_server(clamd) as base_url:
            request = scan_request(base_url, b"expected")
            request.data = b"mutated"
            with self.assertRaises(urllib.error.HTTPError) as mismatch:
                urllib.request.urlopen(request, timeout=2)
            self.assertEqual(400, mismatch.exception.code)
            self.assertEqual(b"HASH_MISMATCH", mismatch.exception.read())
            mismatch.exception.close()

    def test_ready_probe_checks_clamd(self) -> None:
        with clamd_server() as clamd, http_server(clamd) as base_url:
            with urllib.request.urlopen(f"{base_url}/readyz", timeout=2) as response:
                self.assertEqual(b"READY", response.read())


if __name__ == "__main__":
    unittest.main()
