"""Deterministic public-chat fast paths: greeting shortcut and response cache.

Both helpers are wired strictly downstream of the safety regex and the
clinical-education short-circuit in ``main._chat_sync``: an emergency phrase
can never reach a synthesized welcome or a cached answer, and a clinical
question is never answered from the operational cache lane.
"""

import hashlib
import re
import threading
import time
import unicodedata
from collections import OrderedDict

from app.schemas import ChatMode, ChatResponse, ChatSafetyAction

# Short TTL and a small bounded LRU keep a public answer from outliving its
# catalog by much; the cache is a latency nicety, never a source of truth.
CACHE_TTL_SECONDS = 300.0
CACHE_MAX_ENTRIES = 256


def public_chat_cache_key(
    message: str,
    mode: ChatMode,
    index_revision: int,
    top_k: int,
) -> str:
    """Digest the exact inputs the public answer shape depends on.

    ``top_k`` is part of the key because it changes the response shape: the
    public retrieval candidate pool widens with it (``max(top_k, …)``) and the
    citation slice is ``hits[: min(top_k, 3)]``. Two requests that differ only
    in ``top_k`` must never share a cached response.
    """

    normalized = " ".join(message.casefold().split())
    digest = hashlib.sha256(
        f"{normalized}|{mode.value}|{index_revision}|{int(top_k)}".encode("utf-8")
    ).hexdigest()
    return digest


class PublicChatResponseCache:
    """Bounded TTL cache for deterministic grounded public answers only."""

    def __init__(
        self,
        ttl_seconds: float = CACHE_TTL_SECONDS,
        max_entries: int = CACHE_MAX_ENTRIES,
    ) -> None:
        self._ttl = ttl_seconds
        self._max = max_entries
        self._entries: OrderedDict[str, tuple[float, ChatResponse]] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> ChatResponse | None:
        now = time.monotonic()
        with self._lock:
            entry = self._entries.get(key)
            if entry is None:
                return None
            stored_at, response = entry
            if now - stored_at > self._ttl:
                del self._entries[key]
                return None
            self._entries.move_to_end(key)
            return response

    def put(self, key: str, response: ChatResponse) -> None:
        with self._lock:
            self._entries[key] = (time.monotonic(), response)
            self._entries.move_to_end(key)
            while len(self._entries) > self._max:
                self._entries.popitem(last=False)

    def __len__(self) -> int:
        with self._lock:
            return len(self._entries)

    def clear(self) -> None:
        with self._lock:
            self._entries.clear()


def is_cacheable_public_response(response: ChatResponse) -> bool:
    """Only grounded, non-refusal answers enter the cache.

    ``INSUFFICIENT_EVIDENCE`` responses usually mean a still-warming index;
    caching them would extend the empty window instead of letting the next
    caller see the freshly synced catalog.
    """

    return (
        response.safety_action is ChatSafetyAction.ANSWER
        and response.provenance == "local_provider"
        and bool(response.citations)
    )


def _fold(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text.replace("đ", "d").replace("Đ", "D"))
    return "".join(char for char in decomposed if unicodedata.category(char) != "Mn").casefold()


# Mirrors the server-owned greeting contract in Spring's
# ChatSuggestedActionResolver so both layers answer the same way.
_GREETING_PATTERN = re.compile(
    r"^(?:"
    r"(?:xin\s+)?chao(?:\s+(?:ban|bac\s+si|em|tro\s+ly|ad|admin|ban\s+oi|moi\s+nguoi|nha|nhe|ban\s+nhe|em\s+nhe))*"
    r"|hello(?:\s+(?:ban|bot|there|all|oi))?"
    r"|hi(?:\s+(?:ban|all|there|bot))?"
    r"|hey"
    r"|alo(?:\s+ban(?:\s+oi)?)?"
    r"|(?:ban|em|tro\s+ly|bot|may)\s+la\s+(?:ai|gi)(?:\s+(?:a|the|vay|ha|do|the\s+nhi|the\s+ta|vay\s+ta))?"
    r"|gioi\s+thieu(?:\s+(?:ve\s+)?(?:ban|em|tro\s+ly|minh))?"
    r"|(?:ban|em)\s+(?:co\s+the\s+)?giup(?:\s+duoc)?\s+gi(?:\s+(?:cho\s+toi|cho\s+minh|a|the|vay))?"
    r")[\s.!?,;:…]*$"
)

_IDENTITY_PATTERN = re.compile(
    r"(?:ban|em|tro ly|bot|may) la (?:ai|gi)|gioi thieu"
)


def public_greeting_response(message: str, mode: ChatMode) -> ChatResponse | None:
    """Answer a pure greeting/identity question without retrieval or provider."""

    folded = " ".join(_fold(message).split())
    if not folded or not _GREETING_PATTERN.match(folded):
        return None
    if _IDENTITY_PATTERN.search(folded):
        answer = (
            "Chào bạn! Mình là trợ lý thông tin sức khỏe của HealthCare. Mình có thể hỗ trợ bạn "
            "tra cứu Chuyên khoa, Bác sĩ, Cơ sở & giờ làm việc hoặc hướng dẫn đặt lịch khám."
        )
    else:
        answer = (
            "Xin chào! Mình có thể hỗ trợ bạn tra cứu Chuyên khoa, Bác sĩ, Cơ sở & giờ làm việc "
            "hoặc hướng dẫn bắt đầu đặt lịch khám tại HealthCare."
        )
    return ChatResponse(
        answer=answer,
        citations=[],
        provenance="local_provider",
        mode=mode,
        safety_action=ChatSafetyAction.ANSWER,
        cost_tier="local_free",
        routing_reason="public_greeting_shortcut",
    )
