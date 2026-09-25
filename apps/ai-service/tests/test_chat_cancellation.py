"""Cancellation must close an in-flight provider HTTP request."""

from __future__ import annotations

import asyncio
import json
import logging
import socket
import threading
from uuid import uuid4
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Sequence
from unittest.mock import MagicMock

import pytest
import uvicorn

import app.embeddings as embeddings
import app.llm as llm
import app.main as main
from app.cancellation import ChatCancellation
from app.embeddings import OpenAIEmbeddingClient
from app.llm import OpenAIChatClient, resolve_chat


def test_pre_cancelled_chat_never_calls_provider() -> None:
    cancellation = ChatCancellation()
    cancellation.cancel()
    provider = MagicMock()

    with pytest.raises(asyncio.CancelledError):
        resolve_chat("Xin chào", object(), client=provider, cancellation=cancellation)

    provider.complete_json.assert_not_called()


def test_cancellation_ends_in_flight_provider_http_request() -> None:
    provider_started = threading.Event()
    provider_disconnected = threading.Event()
    release_provider = threading.Event()
    client_finished = threading.Event()
    outcome: dict[str, object] = {}

    class ProviderHandler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:
            size = int(self.headers.get("Content-Length", "0"))
            self.rfile.read(size)
            provider_started.set()
            self.connection.settimeout(2)
            try:
                if self.connection.recv(1) == b"":
                    provider_disconnected.set()
            except socket.timeout:
                pass
            release_provider.wait(timeout=2)
            response = b'{"choices":[{"message":{"content":"{\\"answer\\":\\"ok\\"}"}}]}'
            try:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(response)))
                self.end_headers()
                self.wfile.write(response)
            except (BrokenPipeError, ConnectionResetError):
                provider_disconnected.set()

        def log_message(self, *_args: object) -> None:
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), ProviderHandler)
    server.daemon_threads = True
    server_thread = threading.Thread(target=server.serve_forever, daemon=True)
    server_thread.start()
    cancellation = ChatCancellation()
    # The stub provider never validates the bearer token; a per-run throwaway
    # value keeps the fixture free of credential-shaped literals.
    probe_api_key = f"change-me-{uuid4().hex}"
    client = OpenAIChatClient(
        api_key=probe_api_key,
        base_url=f"http://127.0.0.1:{server.server_port}/v1",
        model="probe-model",
        timeout_seconds=5,
        cancellation=cancellation,
    )

    def call_provider() -> None:
        try:
            outcome["result"] = client.complete_json(
                system_prompt="Return JSON.", user_prompt="Synthetic probe."
            )
        except BaseException as exc:
            outcome["error"] = type(exc).__name__
        finally:
            client_finished.set()

    worker = threading.Thread(target=call_provider, daemon=True)
    worker.start()
    try:
        assert provider_started.wait(timeout=5), f"provider did not receive request; worker outcome={outcome}"
        cancellation.cancel()
        assert client_finished.wait(timeout=1.5), "provider HTTP call continued after cancellation"
        assert provider_disconnected.wait(timeout=1.5), "provider socket stayed open"
        assert "result" not in outcome
        assert outcome.get("error") == "CancelledError"
    finally:
        release_provider.set()
        worker.join(timeout=2)
        server.shutdown()
        server.server_close()
        server_thread.join(timeout=2)


def test_real_client_disconnect_closes_fastapi_provider_socket(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider_started = threading.Event()
    provider_disconnected = threading.Event()
    release_provider = threading.Event()
    provider_call_finished = threading.Event()

    class ProviderHandler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:
            self.rfile.read(int(self.headers.get("Content-Length", "0")))
            provider_started.set()
            self.connection.settimeout(3)
            try:
                if self.connection.recv(1) == b"":
                    provider_disconnected.set()
            except socket.timeout:
                pass
            release_provider.wait(timeout=3)

        def log_message(self, *_args: object) -> None:
            pass

    provider = ThreadingHTTPServer(("127.0.0.1", 0), ProviderHandler)
    provider.daemon_threads = True
    provider_thread = threading.Thread(target=provider.serve_forever, daemon=True)
    provider_thread.start()
    monkeypatch.setattr(main.settings, "embedding_provider", "remote")
    monkeypatch.setattr(main.settings, "ai_public_hospital_support_remote_enabled", True)
    monkeypatch.setattr(main.settings, "ai_service_token", "local-disconnect-test-token")

    class TrackedClient(OpenAIChatClient):
        def complete_json(
            self, *, system_prompt: str, user_prompt: str, context: Sequence[str] = ()
        ) -> object:
            try:
                return super().complete_json(
                    system_prompt=system_prompt, user_prompt=user_prompt, context=context
                )
            finally:
                provider_call_finished.set()

    def local_client(_settings: object, cancellation: ChatCancellation | None = None) -> OpenAIChatClient:
        # The stub never validates the bearer token; per-run throwaway avoids
        # credential-shaped literals.
        tracked_api_key = f"change-me-{uuid4().hex}"
        return TrackedClient(
            api_key=tracked_api_key,
            base_url=f"http://127.0.0.1:{provider.server_port}/v1",
            model="probe-model",
            timeout_seconds=5,
            cancellation=cancellation,
        )

    monkeypatch.setattr(llm, "build_llm_client", local_client)
    listener = socket.socket()
    listener.bind(("127.0.0.1", 0))
    port = listener.getsockname()[1]
    listener.close()
    uvicorn_error_logger = logging.getLogger("uvicorn.error")
    prev_uvicorn_level = uvicorn_error_logger.level
    server = uvicorn.Server(
        uvicorn.Config(
            main.app,
            host="127.0.0.1",
            port=port,
            log_level="error",
            lifespan="off",
            log_config=None,
        )
    )
    server_thread = threading.Thread(target=server.run, daemon=True)
    server_thread.start()

    async def disconnect_client() -> None:
        for _ in range(100):
            if server.started:
                break
            await asyncio.sleep(0.05)
        assert server.started
        body = json.dumps(
            {"message": "Xin chào", "public_support_chat": True, "mode": "HOSPITAL_SUPPORT"}
        ).encode()
        _, writer = await asyncio.open_connection("127.0.0.1", port)
        writer.write(
            f"POST /chat HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n"
            "Content-Type: application/json\r\n"
            "X-AI-Service-Token: local-disconnect-test-token\r\n"
            f"Content-Length: {len(body)}\r\nConnection: close\r\n\r\n".encode() + body
        )
        await writer.drain()
        assert await asyncio.to_thread(provider_started.wait, 5)
        writer.close()
        await writer.wait_closed()
        assert await asyncio.to_thread(provider_disconnected.wait, 1.5)
        assert await asyncio.to_thread(provider_call_finished.wait, 1.5)

    try:
        asyncio.run(disconnect_client())
    finally:
        release_provider.set()
        server.should_exit = True
        server_thread.join(timeout=2)
        assert not server_thread.is_alive(), "isolated ASGI server leaked into later tests"
        uvicorn_error_logger.setLevel(prev_uvicorn_level)
        logging.getLogger("uvicorn.error.healthcare.ai.rag").setLevel(logging.NOTSET)
        provider.shutdown()
        provider.server_close()
        provider_thread.join(timeout=2)


def test_real_client_disconnect_closes_fastapi_embedding_socket(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    provider_started = threading.Event()
    provider_disconnected = threading.Event()
    release_provider = threading.Event()
    provider_call_finished = threading.Event()

    class ProviderHandler(BaseHTTPRequestHandler):
        def do_POST(self) -> None:
            self.rfile.read(int(self.headers.get("Content-Length", "0")))
            provider_started.set()
            self.connection.settimeout(3)
            try:
                if self.connection.recv(1) == b"":
                    provider_disconnected.set()
            except socket.timeout:
                pass
            release_provider.wait(timeout=3)
            payload = json.dumps({"data": [{"embedding": [0.1] * 384}]}).encode()
            try:
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
            except (BrokenPipeError, ConnectionResetError):
                provider_disconnected.set()

        def log_message(self, *_args: object) -> None:
            pass

    provider = ThreadingHTTPServer(("127.0.0.1", 0), ProviderHandler)
    provider.daemon_threads = True
    provider_thread = threading.Thread(target=provider.serve_forever, daemon=True)
    provider_thread.start()
    monkeypatch.setattr(main.settings, "embedding_provider", "remote")
    monkeypatch.setattr(main.settings, "ai_provider", "remote")
    monkeypatch.setattr(main.settings, "ai_api_key", f"change-me-{uuid4().hex}")
    monkeypatch.setattr(main.settings, "ai_embedding_model", "probe-embedding")
    monkeypatch.setattr(main.settings, "ai_base_url", f"http://127.0.0.1:{provider.server_port}/v1")
    monkeypatch.setattr(main.settings, "ai_timeout_seconds", 5.0)
    monkeypatch.setattr(main.settings, "ai_service_runtime", "synthetic-beta")
    monkeypatch.setattr(main.settings, "ai_patient_chat_remote_enabled", True)
    monkeypatch.setattr(main.settings, "remote_ai_synthetic_only", False)
    monkeypatch.setattr(main.settings, "remote_ai_release_hold", True)
    monkeypatch.setattr(main.settings, "ai_service_token", "local-disconnect-test-token")
    rag = MagicMock()
    monkeypatch.setattr(main, "rag_service", rag)

    class TrackedClient(OpenAIEmbeddingClient):
        def embed(self, text: str) -> embeddings.EmbeddingResult:
            try:
                return super().embed(text)
            finally:
                provider_call_finished.set()

    def local_client(
        _settings: object,
        cancellation: ChatCancellation | None = None,
    ) -> OpenAIEmbeddingClient:
        return TrackedClient(
            api_key=f"change-me-{uuid4().hex}",
            base_url=f"http://127.0.0.1:{provider.server_port}/v1",
            model="probe-embedding",
            timeout_seconds=5,
            cancellation=cancellation,
        )

    monkeypatch.setattr(embeddings, "build_embedding_client", local_client)
    listener = socket.socket()
    listener.bind(("127.0.0.1", 0))
    port = listener.getsockname()[1]
    listener.close()
    uvicorn_error_logger = logging.getLogger("uvicorn.error")
    prev_uvicorn_level = uvicorn_error_logger.level
    server = uvicorn.Server(
        uvicorn.Config(
            main.app,
            host="127.0.0.1",
            port=port,
            log_level="error",
            lifespan="off",
            log_config=None,
        )
    )
    server_thread = threading.Thread(target=server.run, daemon=True)
    server_thread.start()

    async def disconnect_client() -> None:
        for _ in range(100):
            if server.started:
                break
            await asyncio.sleep(0.05)
        assert server.started
        body = json.dumps({"message": "Xin chào"}).encode()
        _, writer = await asyncio.open_connection("127.0.0.1", port)
        writer.write(
            f"POST /chat/retrieve HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n"
            "Content-Type: application/json\r\n"
            "X-AI-Service-Token: local-disconnect-test-token\r\n"
            f"Content-Length: {len(body)}\r\nConnection: close\r\n\r\n".encode() + body
        )
        await writer.drain()
        assert await asyncio.to_thread(provider_started.wait, 5)
        writer.close()
        await writer.wait_closed()
        assert await asyncio.to_thread(provider_disconnected.wait, 1.5)
        assert await asyncio.to_thread(provider_call_finished.wait, 1.5)

    try:
        asyncio.run(disconnect_client())
        rag.search.assert_not_called()
    finally:
        release_provider.set()
        server.should_exit = True
        server_thread.join(timeout=2)
        assert not server_thread.is_alive(), "isolated ASGI server leaked into later tests"
        uvicorn_error_logger.setLevel(prev_uvicorn_level)
        logging.getLogger("uvicorn.error.healthcare.ai.rag").setLevel(logging.NOTSET)
        provider.shutdown()
        provider.server_close()
        provider_thread.join(timeout=2)
