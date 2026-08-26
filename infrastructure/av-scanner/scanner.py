"""Private HTTP-to-clamd adapter for consultation attachments.

The service deliberately exposes a tiny contract to the Spring backend:
authenticated raw bytes in, a CLEAN or MALWARE verdict out.  Request bodies,
object keys, hashes and tokens are never logged.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import socket
import struct
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


DEFAULT_MAX_SCAN_BYTES = 10 * 1024 * 1024
CHUNK_SIZE = 64 * 1024


def _required_token() -> str:
    token = os.environ.get("SCANNER_SERVICE_TOKEN", "").strip()
    if len(token) < 32:
        raise RuntimeError("SCANNER_SERVICE_TOKEN must contain at least 32 characters")
    return token


def _integer_env(name: str, default: int, minimum: int, maximum: int) -> int:
    raw = os.environ.get(name, "").strip()
    value = default if not raw else int(raw)
    if value < minimum or value > maximum:
        raise RuntimeError(f"{name} is outside the supported range")
    return value


def _clamd_command(host: str, port: int, payload: bytes | None) -> str:
    timeout = _integer_env("CLAMD_TIMEOUT_SECONDS", 15, 1, 120)
    with socket.create_connection((host, port), timeout=timeout) as client:
        client.settimeout(timeout)
        if payload is None:
            client.sendall(b"zPING\0")
        else:
            client.sendall(b"zINSTREAM\0")
            for offset in range(0, len(payload), CHUNK_SIZE):
                chunk = payload[offset : offset + CHUNK_SIZE]
                client.sendall(struct.pack("!I", len(chunk)))
                client.sendall(chunk)
            client.sendall(struct.pack("!I", 0))

        response = bytearray()
        while len(response) <= 4096:
            chunk = client.recv(4096)
            if not chunk:
                break
            response.extend(chunk)
            if b"\0" in chunk or b"\n" in chunk:
                break
        if not response:
            raise RuntimeError("clamd returned an empty response")
        return bytes(response).split(b"\0", 1)[0].decode("utf-8", "replace").strip()


def clamd_ready(host: str, port: int) -> bool:
    try:
        return _clamd_command(host, port, None).upper() == "PONG"
    except (OSError, RuntimeError, ValueError):
        return False


def scan_with_clamd(host: str, port: int, payload: bytes) -> str:
    response = _clamd_command(host, port, payload).upper()
    # ClamAV prefixes the verdict with `stream:`. Parse the terminal token
    # exactly so a malformed response such as `NOT OK` cannot become CLEAN.
    verdict = response.rsplit(":", 1)[-1].strip()
    if verdict == "FOUND" or verdict.endswith(" FOUND"):
        return "MALWARE"
    if verdict == "OK":
        return "CLEAN"
    raise RuntimeError("clamd returned an unsupported verdict")


class ScannerServer(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def __init__(
        self,
        server_address: tuple[str, int],
        token: str,
        clamd_host: str,
        clamd_port: int,
        max_scan_bytes: int,
    ) -> None:
        super().__init__(server_address, ScannerHandler)
        self.service_token = token
        self.clamd_host = clamd_host
        self.clamd_port = clamd_port
        self.max_scan_bytes = max_scan_bytes


class ScannerHandler(BaseHTTPRequestHandler):
    server: ScannerServer
    protocol_version = "HTTP/1.1"

    def log_message(self, _format: str, *args: object) -> None:
        # Suppress BaseHTTPRequestHandler request logging. Paths, headers and
        # object identifiers must not escape this private boundary.
        return

    def _respond(self, status: HTTPStatus, body: str) -> None:
        encoded = body.encode("ascii")
        self.send_response(status)
        self.send_header("Content-Type", "text/plain; charset=us-ascii")
        self.send_header("Content-Length", str(len(encoded)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(encoded)

    def do_GET(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        if self.path == "/livez":
            self._respond(HTTPStatus.OK, "LIVE")
            return
        if self.path == "/readyz":
            ready = clamd_ready(self.server.clamd_host, self.server.clamd_port)
            self._respond(HTTPStatus.OK if ready else HTTPStatus.SERVICE_UNAVAILABLE,
                          "READY" if ready else "UNAVAILABLE")
            return
        self._respond(HTTPStatus.NOT_FOUND, "NOT_FOUND")

    def do_POST(self) -> None:  # noqa: N802 - required by BaseHTTPRequestHandler
        if self.path != "/scan":
            self._respond(HTTPStatus.NOT_FOUND, "NOT_FOUND")
            return

        supplied = self.headers.get("Authorization", "")
        expected = f"Bearer {self.server.service_token}"
        if not hmac.compare_digest(supplied.encode(), expected.encode()):
            self._respond(HTTPStatus.UNAUTHORIZED, "UNAUTHORIZED")
            return
        if self.headers.get_content_type() != "application/octet-stream":
            self._respond(HTTPStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE")
            return

        raw_length = self.headers.get("Content-Length", "")
        try:
            length = int(raw_length)
        except ValueError:
            self._respond(HTTPStatus.LENGTH_REQUIRED, "LENGTH_REQUIRED")
            return
        if length < 1 or length > self.server.max_scan_bytes:
            self._respond(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, "PAYLOAD_REJECTED")
            return

        payload = self.rfile.read(length)
        if len(payload) != length:
            self._respond(HTTPStatus.BAD_REQUEST, "TRUNCATED_BODY")
            return
        expected_sha = self.headers.get("X-Content-SHA256", "").strip().lower()
        actual_sha = hashlib.sha256(payload).hexdigest()
        if len(expected_sha) != 64 or not hmac.compare_digest(expected_sha, actual_sha):
            self._respond(HTTPStatus.BAD_REQUEST, "HASH_MISMATCH")
            return

        try:
            verdict = scan_with_clamd(
                self.server.clamd_host,
                self.server.clamd_port,
                payload,
            )
        except (OSError, RuntimeError, ValueError):
            self._respond(HTTPStatus.SERVICE_UNAVAILABLE, "UNAVAILABLE")
            return
        self._respond(HTTPStatus.OK, verdict)


def build_server() -> ScannerServer:
    host = os.environ.get("SCANNER_BIND_HOST", "0.0.0.0").strip() or "0.0.0.0"
    port = _integer_env("SCANNER_PORT", 8080, 1, 65535)
    clamd_host = os.environ.get("CLAMD_HOST", "clamav").strip() or "clamav"
    clamd_port = _integer_env("CLAMD_PORT", 3310, 1, 65535)
    max_scan_bytes = _integer_env(
        "MAX_SCAN_BYTES",
        DEFAULT_MAX_SCAN_BYTES,
        1,
        DEFAULT_MAX_SCAN_BYTES,
    )
    return ScannerServer(
        (host, port),
        _required_token(),
        clamd_host,
        clamd_port,
        max_scan_bytes,
    )


if __name__ == "__main__":
    build_server().serve_forever(poll_interval=0.25)
