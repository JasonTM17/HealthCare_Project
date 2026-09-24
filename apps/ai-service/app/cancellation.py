"""Request-scoped cancellation shared by ASGI handlers and provider workers."""

from __future__ import annotations

import asyncio
import threading
from collections.abc import Callable


class ChatCancellation:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._cancelled = False
        self._callbacks: list[Callable[[], None]] = []

    @property
    def cancelled(self) -> bool:
        with self._lock:
            return self._cancelled

    def raise_if_cancelled(self) -> None:
        if self.cancelled:
            raise asyncio.CancelledError()

    def cancel(self) -> None:
        with self._lock:
            if self._cancelled:
                return
            self._cancelled = True
            callbacks = tuple(self._callbacks)
            self._callbacks.clear()
        for callback in callbacks:
            callback()

    def register(self, callback: Callable[[], None]) -> Callable[[], None]:
        with self._lock:
            already_cancelled = self._cancelled
            if not already_cancelled:
                self._callbacks.append(callback)
        if already_cancelled:
            callback()

        def unregister() -> None:
            with self._lock:
                if callback in self._callbacks:
                    self._callbacks.remove(callback)

        return unregister
