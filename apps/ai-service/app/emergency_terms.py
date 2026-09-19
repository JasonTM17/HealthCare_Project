"""Tiered emergency presentation vocabulary for the pre-provider clinical gate.

The gate must be decisive in both directions. A missed emergency means a patient
does not call an ambulance; a false emergency banner on an ordinary question
teaches visitors to ignore the banner, which costs the same lives more slowly.
This module therefore does three things the flat substring list could not:

* matches on **word boundaries** rather than raw substrings, so a homophone such
  as ``tu tuc`` ("self-provided") no longer reads as ``tu tu`` (self-harm);
* keeps the handful of genuinely ambiguous homophones in a **separate family**
  that requires either a self-harm companion term or the absence of an
  information-seeking frame, because ``tu van`` is overwhelmingly "tư vấn"
  (consult) in visitor traffic;
* separates terms that survive **squashed** matching. Squashing defeats letter
  spacing but erases word boundaries, so only distinctive multi-syllable terms
  are squashed; short collision-prone ones rely on the boundary matcher.

Every term is written in the normalised form produced by
``llm._normalize_sensitive_text`` (casefolded, diacritic-free, ``đ`` folded to
``d``). Terms are still normalised defensively at import so a diacritic typo in
this table cannot silently disable a rule.
"""

from __future__ import annotations

import html
import re
import unicodedata
from typing import Final

# Folded here rather than imported from ``app.llm`` so this module stays a leaf:
# the gate compiles its matchers at import time, and reaching back into llm
# would close an import cycle. The fold is the same one the gate applies to
# visitor text, plus the eth homoglyph (U+00F0) that survives NFKC/NFKD and let
# "ðột quỵ" bypass a rule written for "đột quỵ".
_ETH_TRANSLATION = {ord("đ"): "d", ord("Đ"): "D", ord("ð"): "d", ord("Ð"): "D"}


def _fold(value: str) -> str:
    """Mirror ``llm._normalize_sensitive_text`` for vocabulary folding."""

    markup_free = re.sub(r"<[^>]*>", " ", html.unescape(value))
    compatibility = unicodedata.normalize("NFKC", markup_free).translate(_ETH_TRANSLATION)
    without_diacritics = "".join(
        character
        for character in unicodedata.normalize("NFKD", compatibility)
        if not unicodedata.combining(character) and unicodedata.category(character) != "Cf"
    )
    return " ".join(without_diacritics.casefold().split())

# -- Terms that escalate on their own, with no severity qualifier ---------------
#
# These are the presentations where waiting for a qualifier costs organ or life:
# time-critical cardiovascular, respiratory, neurological, haemorrhagic,
# anaphylactic, obstetric and neonatal deterioration.
TIER1_TERMS: Final[tuple[str, ...]] = (
    # Chest pain and acute coronary syndrome. Unqualified "đau ngực" escalates:
    # a qualifier is not something a frightened patient reliably supplies.
    "dau nguc",
    "that nguc",
    "dau nguc lan ra tay",
    "dau nguc lan tay",
    "dau tim",
    "nhoi mau co tim",
    "nhoi mau tim",
    "heart attack",
    "cardiac arrest",
    "chest pain",
    "xuong uc",
    "sau xuong uc",
    "dau sau xuong uc",
    "dau xuong uc",
    "retrosternal",
    "nang nguc",
    "tuc nguc",
    "vang mo hoi lanh",
    "van mo hoi lanh",
    "va mo hoi lanh",
    "mo hoi lanh",
    # Dyspnoea family. The diacritic-free typing "khong tho duoc" is the most
    # common Vietnamese input and previously escaped every rule.
    "kho tho",
    "khong tho duoc",
    "khong tho noi",
    "tho kho khan",
    "kho tho du doi",
    "nghet tho",
    "nghe tho",
    "ngat tho",
    "tho rit",
    "tho rut",
    "ngung tho",
    "ngung tim",
    "shortness of breath",
    "difficulty breathing",
    "trouble breathing",
    "heavy breathing",
    "breathing difficulty",
    "cant breathe",
    "cannot breathe",
    "can't breathe",
    "gasping",
    "choking",
    # Stroke and FAST signs, including the reversed word orders visitors use.
    "dot quy",
    "tai bien",
    "tai bien mach mau nao",
    "meo mieng",
    "mieng bi meo",
    "moi meo",
    "yeu liet",
    "liet nua nguoi",
    "liet mot ben",
    "liet tay",
    "liet chan",
    "te mot ben",
    "te nua nguoi",
    "noi ngong",
    "noi kho",
    "khong noi duoc",
    "noi khong ro",
    "mo mat dot ngot",
    "mat thi luc",
    "stroke",
    "slurred speech",
    "face drooping",
    "numbness on one side",
    "sudden weakness",
    # Major haemorrhage.
    "chay mau khong cam",
    "chay mau khong ngung",
    "chay mau am dao",
    "chay mau o at",
    "non ra mau",
    "ho ra mau",
    "tieu ra mau",
    "di ngoai ra mau",
    "xuat huyet",
    "xuat huyet nao",
    "xuat huyet tieu hoa",
    "sot xuat huyet",
    "severe bleeding",
    "heavy bleeding",
    "vomiting blood",
    "coughing up blood",
    "bleeding heavily",
    # Anaphylaxis and airway compromise.
    "soc phan ve",
    "phan ve",
    "di ung nang",
    "phu moi",
    "sung moi",
    "co that thanh quan",
    "anaphylaxis",
    "anaphylactic",
    # Seizure, coma, loss of consciousness.
    "co giat",
    "dong kinh",
    "dong kinh lien tuc",
    "san giat",
    "hon me",
    "bat tinh",
    "mat y thuc",
    "ngat xiu",
    "ngat",
    "seizure",
    "convulsion",
    "unconscious",
    "fainted",
    "coma",
    "unresponsive",
    "collapsed",
    "sudden collapse",
    # Poisoning, overdose, drowning, inhalation and major trauma.
    "ngo doc",
    "trung doc",
    "paraquat",
    "thuoc diet co",
    "qua lieu thuoc",
    "qua lieu",
    "uong thuoc doc",
    "uong thuoc ngu",
    "chet duoi",
    "duoi nuoc",
    "dien giat",
    "bong do",
    "bong sau",
    "chan thuong dau",
    "chan thuong so nao",
    "tai nan giao thong",
    "poisoned",
    "poisoning",
    "pesticide",
    "hoa chat",
    "uong hoa chat",
    "axit",
    "uong axit",
    "thuoc tay",
    "uong thuoc tay",
    "overdose",
    "overdosed",
    "drowned",
    # Obstetric emergencies. A pregnant patient reporting any of these is a
    # two-patient emergency and must not wait for a severity qualifier.
    "say thai",
    "thai luu",
    "thai ngoai tu cung",
    "vo oi",
    "de non",
    "bau bi dau bung",
    "mang thai bi ra mau",
    "mang thai ra mau",
    "giam cu dong thai",
    "thai khong may",
    "nhau bong non",
    "tien san giat",
    # Neonatal and paediatric red flags: infants decompensate fast, so these
    # escalate without a duration or severity qualifier.
    "tre bo bu",
    "be bo bu",
    "bo bu",
    "tre khong chiu an",
    "tre tim tai",
    "tim tai",
    "thop lom",
    "tre kho tho",
    "tre co giat",
    "tre sot cao",
    "sot cao khong ha",
    "tre li bi",
    "tre khong phan ung",
    # End-of-life and imminent-death phrasing.
    "tu vong",
    "nguy kich",
    "nguy hiem tinh mang",
    "sap chet",
    "critical condition",
)

# -- Self-harm and suicide family -------------------------------------------------
#
# Unambiguous self-harm intent. These escalate regardless of framing because the
# vocabulary itself cannot be read as anything else in a hospital context.
SELF_HARM_TERMS: Final[tuple[str, ...]] = (
    "tu tu",
    "tu sat",
    "tu ket lieu",
    "tu lam dau",
    "tu huy hoai",
    "ket lieu cuoc doi",
    "ket lieu cuoc song",
    "ket thuc cuoc doi",
    "ket thuc cuoc song",
    "khong muon song",
    "khong muon song nua",
    "khong con muon song",
    "muon chet",
    "muon chet di",
    "chet di",
    "khong con ly do song",
    "khong con ly do de song",
    "chan song",
    "chan cuoc song",
    "treo co",
    "cat tay",
    "rach tay",
    "cat co tay",
    "nhay lau",
    "nhay cau",
    "ra di mai mai",
    "nghi ngoi vinh vien",
    "bien mat khoi the gioi",
    "khong muon o day nua",
    "end my life",
    "kill myself",
    "kill me",
    "suicide",
    "suicidal",
    "take my own life",
    "want to die",
    "wanna die",
    "wish i was dead",
    "wish i were dead",
    "better off dead",
    "dont want to live",
    "do not want to live",
    "no reason to live",
    "not worth living",
    "self harm",
    "selfharm",
    "hurt myself",
    "cut myself",
    "end it all",
    "unalive",
    "sleep forever",
    "not want to be alive",
    "cant go on",
    "jump off a bridge",
    "jump off a building",
)

# ``tu van`` is the one entry in the self-harm family that collides head-on with
# everyday vocabulary: written without diacritics, "tự vẫn" (suicide) and
# "tư vấn" (consultation) are the same five-letter string, and "muốn tư vấn" is
# the single most common way visitors open a conversation with this assistant.
# Escalating it would put a 115 banner on ordinary consultation requests, which
# is the fastest way to teach patients to ignore the banner. It therefore needs
# corroboration before it counts as a crisis.
AMBIGUOUS_SELF_HARM_TERMS: Final[tuple[str, ...]] = ("tu van",)

# Phrases that describe an intention to end things but are ordinary language on
# their own: "kết thúc mọi thứ trong ngày làm việc" is someone finishing their
# workload. They escalate only when an explicit self-harm intent verb precedes
# them, which is how the original gate treated them.
INTENT_BOUND_SELF_HARM_TERMS: Final[tuple[str, ...]] = (
    "ket thuc moi thu",
    "ket thuc tat ca",
    "ket thuc moi chuyen",
)

# Intent verbs that turn an intent-bound phrase, or the ambiguous "tu van"
# homophone, into a stated intention ("tôi định tự vẫn thôi").
SELF_HARM_INTENT_VERBS: Final[tuple[str, ...]] = (
    "dinh",
    "muon",
    "se",
    "sap",
    "dang",
    "co y",
    "dang dinh",
    "quyet dinh",
)

# Consultation complements. Their presence next to "tu van" settles the
# homophone in favour of "tư vấn" (consult), so no banner is raised no matter
# which intent verb precedes it. Without these, "muốn tư vấn dinh dưỡng" —
# an ordinary request — would read as "muốn tự vẫn".
CONSULT_FRAME_TERMS: Final[tuple[str, ...]] = (
    "tu van ve",
    "tu van cach",
    "tu van gi",
    "tu van suc khoe",
    "tu van mien phi",
    "tu van truc tuyen",
    "tu van online",
    "tu van dinh duong",
    "tu van benh",
    "tu van cho",
    "tu van lich",
    "tu van kham",
    "tu van theo",
    "tu van nhanh",
    "tu van bac si",
    "tu van y te",
    "tu van dien thoai",
    "tu van qua dien thoai",
    "tu van giup",
    "tu van them",
    "tu van cu the",
    "tu van chung",
    "dat lich tu van",
    "lich tu van",
    "nhan tu van",
    "hoi tu van",
    "consultation",
    "consult",
    "advice about",
    "ask about",
    "information about",
)

# ``tư vấn`` is a transitive verb: it takes a topic object ("tư vấn dinh dưỡng",
# "tư vấn về bệnh gan"). ``tự vẫn`` is intransitive and is followed by a reason,
# a companion, or a time — the shape a decision takes.
#
# Requiring the ambiguous run to be *clause-final* was too strict: it missed
# "tôi muốn tự vẫn với vợ con", "tôi định tự vẫn vì mất việc" and "tự vẫn cùng
# con", all of which the previous release caught and all of which are stated
# intentions, not topic questions. The rule is therefore a positive one — an
# intent verb plus one of these continuations reads as a decision — while a
# consultation complement still suppresses.
SELF_HARM_CLAUSE_FINAL_MARKERS: Final[tuple[str, ...]] = (
    "thoi",
    "roi",
    "luon",
    "di",
    "day",
    "vay",
    "nua",
    "that",
    "qua",
    "a",
    "u",
    "oi",
)

# Continuations that follow a stated decision and not a consultation topic.
# "với" is deliberately absent: "tư vấn với bác sĩ" is an ordinary request, so
# it is resolved separately below.
SELF_HARM_DECISION_CONTINUATIONS: Final[tuple[str, ...]] = (
    "cung",
    "vi",
    "boi",
    "sang",
    "mai",
    "chieu",
    "toi",
    "ngay",
    "dem",
    "trong",
    "de",
    "khong",
)

# Object of "với": a family relationship continues a decision, a clinical role
# makes it a consultation request.
SELF_HARM_COMPANION_TERMS: Final[tuple[str, ...]] = (
    "vo",
    "chong",
    "con",
    "con trai",
    "con gai",
    "me",
    "ba",
    "cha",
    "bo",
    "gia dinh",
    "nguoi than",
    "em",
    "anh",
    "chi",
)

_AMBIGUOUS_TERM_PATTERN = r"\btu\W+van\b"
_CLAUSE_FINAL_PATTERN: Final[re.Pattern[str]] = re.compile(
    _AMBIGUOUS_TERM_PATTERN
    + r"(?:\W+(?:"
    + "|".join(SELF_HARM_CLAUSE_FINAL_MARKERS)
    + r"))*\W*[.!?…]*$"
)
_DECISION_CONTINUATION_PATTERN: Final[re.Pattern[str]] = re.compile(
    _AMBIGUOUS_TERM_PATTERN
    + r"\W+(?:"
    + "|".join(SELF_HARM_DECISION_CONTINUATIONS)
    + r")\b"
)
_COMPANION_PATTERN: Final[re.Pattern[str]] = re.compile(
    _AMBIGUOUS_TERM_PATTERN
    + r"\W+(?:voi|cung)\W+(?:"
    + "|".join(SELF_HARM_COMPANION_TERMS)
    + r")\b"
)

# Corroborating vocabulary that disambiguates ``tu van`` toward its crisis
# reading ("tôi muốn tự vẫn, không muốn sống nữa"). The ambiguous term itself is
# deliberately absent: listing it here would make it corroborate its own
# presence and every consultation request would escalate again.
SELF_HARM_CORROBORATORS: Final[tuple[str, ...]] = (
    "chet",
    "tu tu",
    "tu sat",
    "tu ket lieu",
    "tu lam dau",
    "ket lieu",
    "khong muon song",
    "muon chet",
    "chan song",
    "giai thoat",
    "ket thuc",
    "bien mat",
    "ra di",
    "nhay lau",
    "nhay cau",
    "treo co",
    "cat tay",
    "death",
    "die",
    "dying",
    "dead",
    "suicide",
    "end it",
)

# -- Severity-qualified rules -----------------------------------------------------
#
# Moderate symptoms that are ordinary on their own and become surgical or
# neurological emergencies once a severity marker is attached. Both halves must
# be present, which is why these are pairs rather than terms.
SEVERITY_MARKERS: Final[tuple[str, ...]] = (
    "du doi",
    "rat du doi",
    "khong chiu duoc",
    "khong chiu noi",
    "quan quai",
    "dua nay",
    "nhu bua bo a",
    "dot ngot",
    "khong ngung",
    "lien tuc",
    "ngay cang nang",
    "nang len",
)

# (symptom terms, severity markers, minimum count of distinct markers)
SEVERITY_BOUND_RULES: Final[tuple[tuple[tuple[str, ...], tuple[str, ...], int], ...]] = (
    # A burn escalates on extent and site, not on the word "burn".
    #
    # "bỏng nặng" is deliberately NOT a marker: diacritic-free it is identical to
    # "bóng nắng" (the shadow of sunlight), so "bóng nắng chiếu vào phòng có hại
    # không?" — an ordinary question about a room — raised the 115 banner. The
    # collision cannot be resolved lexically, and a false banner on a
    # non-emergency costs more than the recall it buys, because the burn cases
    # that matter are described by extent or site ("bỏng rộng", "bỏng toàn
    # thân", "bỏng ở mặt", "bỏng độ 3") and those all still escalate.
    (
        ("bong", "phong rong", "bong nuoc soi"),
        ("do", "sau", "rong", "nhieu", "toan than", "tre em", "mat", "ho hap"),
        1,
    ),
    # Chest pain in the reversed word order visitors actually type
    # ("ngực đau dữ dội"), which the forward-only phrase pattern never matched.
    (
        ("nguc dau", "nguc that", "nguc nhoi", "nguc bi dau"),
        ("du doi", "that chat", "nhu bi de", "khong chiu duoc", "lan ra tay"),
        1,
    ),
    (
        ("dau bung", "dau bung duoi", "dau vung bung"),
        ("du doi", "khong chiu duoc", "quan quai", "nhu dao dam", "dot ngot", "cung bung"),
        1,
    ),
    (
        # Headache escalates on the thunderclap presentation and on the
        # meningitic/neurological companions, not on severity alone. "Đau đầu dữ
        # dội" by itself is how a migraine is described, and escalating every
        # migraine is how a 115 banner becomes noise. The audited miss was
        # "đau đầu dữ dội đột ngột", which this catches.
        ("dau dau", "nhuc dau"),
        ("dot ngot", "nhu bua bo a", "kem co cung co", "cung co", "cung gieu"),
        1,
    ),
    (
        ("sot", "sot cao"),
        ("khong ha", "lien tuc", "co giat", "lon xon", "li bi"),
        1,
    ),
)

# -- Squashed matching ------------------------------------------------------------
#
# ``_policy_variants`` collapses letter-spaced evasion ("d a u   n g u c"), and
# collapsing removes the inter-word spaces the boundary matcher depends on, so
# multi-syllable terms also need a squashed net. Squashing every term would
# reintroduce exactly the substring collisions this module exists to remove, so
# the net is limited to terms distinctive enough that an accidental match is not
# credible. Six characters is the shortest squashed form among the multi-syllable
# emergency terms ("dautim", "cogiat", "khotho"); single-syllable terms such as
# "ngat" are left to the boundary matcher, which handles their collapsed form
# correctly because collapsing a one-word term leaves it a word.
_SQUASH_MIN_LENGTH: Final[int] = 6


def _normalize(term: str) -> str:
    """Fold a term the same way the gate folds visitor text."""

    return _fold(term)


def _compile_boundary_matcher(terms: tuple[str, ...]) -> re.Pattern[str] | None:
    """Compile ``\\b(?:a|b|c)\\b`` allowing arbitrary gaps between the words.

    ``\\W+`` between words is deliberate: it absorbs the filler visitors insert
    ("đau ngực, dữ dội"), while the surrounding word boundaries keep a term from
    matching inside a longer unrelated word.
    """

    parts = [
        r"\W+".join(re.escape(word) for word in _normalize(term).split())
        for term in terms
    ]
    parts = [part for part in parts if part]
    if not parts:
        return None
    ordered = sorted(parts, key=len, reverse=True)
    return re.compile(r"\b(?:" + "|".join(ordered) + r")\b")


def _squash(term: str) -> str:
    return re.sub(r"[^0-9a-z]", "", _normalize(term))


def _compile_squash_matcher(terms: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(
        squashed
        for squashed in (_squash(term) for term in terms)
        if len(squashed) >= _SQUASH_MIN_LENGTH
    )


_TIER1_BOUNDARY = _compile_boundary_matcher(TIER1_TERMS)
_SELF_HARM_BOUNDARY = _compile_boundary_matcher(SELF_HARM_TERMS)
_INTENT_BOUND_SELF_HARM_BOUNDARY = _compile_boundary_matcher(INTENT_BOUND_SELF_HARM_TERMS)
_INTENT_VERB_BOUNDARY = _compile_boundary_matcher(SELF_HARM_INTENT_VERBS)
_AMBIGUOUS_BOUNDARY = _compile_boundary_matcher(AMBIGUOUS_SELF_HARM_TERMS)
_CORROBORATOR_BOUNDARY = _compile_boundary_matcher(SELF_HARM_CORROBORATORS)
_CONSULT_FRAME_BOUNDARY = _compile_boundary_matcher(CONSULT_FRAME_TERMS)

_TIER1_SQUASHED = _compile_squash_matcher(TIER1_TERMS)
# "tutu" is added by hand: it is shorter than the distinctive-only threshold,
# but it is the one short term whose joined-syllable form visitors actually type
# ("tututroi"). _squashed_self_harm_hit resolves its ambiguity against the
# benign words it also opens ("tự túc", "tư tưởng").
_SELF_HARM_SQUASHED = (*_compile_squash_matcher(SELF_HARM_TERMS), "tutu")

# Precompiled once: each rule becomes (symptom matcher, marker matcher, minimum
# distinct markers). Compiling inside the request path would rebuild these
# alternations on every chat turn.
_SEVERITY_COMPILED: Final[tuple[tuple[re.Pattern[str] | None, re.Pattern[str] | None, int], ...]] = tuple(
    (
        _compile_boundary_matcher(symptoms),
        _compile_boundary_matcher(markers),
        minimum,
    )
    for symptoms, markers, minimum in SEVERITY_BOUND_RULES
)
_SEVERITY_MARKER_MATCHERS: Final[tuple[tuple[re.Pattern[str] | None, ...], ...]] = tuple(
    tuple(_compile_boundary_matcher((marker,)) for marker in markers)
    for _symptoms, markers, _minimum in SEVERITY_BOUND_RULES
)


def _squash_text(text: str) -> str:
    return re.sub(r"[^0-9a-z]", "", text)


def _boundary_hit(pattern: re.Pattern[str] | None, text: str) -> bool:
    return bool(pattern is not None and pattern.search(text))


# Squashed "tutu" is genuinely ambiguous. It is the self-harm phrase "tự tử"
# ("tu tu"), and it is also the opening of ordinary words: "tự túc"
# (self-catered), "tư tưởng" (thought), "túi tiền", "tuỳ", "tùng". Word-boundary
# matching already reads "tự tử" correctly, so the squashed net only needs to
# catch inputs where the visitor joined the syllables ("tututroi"). Those are
# distinguished by what follows the matched run: a benign continuation makes it
# a different word, anything else leaves it a self-harm phrase.
_TUTU_BENIGN_CONTINUATIONS: Final[frozenset[str]] = frozenset("conjuy")


def _squashed_self_harm_hit(squashed: str) -> bool:
    for term in _SELF_HARM_SQUASHED:
        start = squashed.find(term)
        while start != -1:
            if term != "tutu":
                return True
            following = squashed[start + len(term) : start + len(term) + 1]
            if following not in _TUTU_BENIGN_CONTINUATIONS:
                return True
            start = squashed.find(term, start + 1)
    return False


def emergency_hit(variants: tuple[str, ...] | list[str]) -> bool:
    """Return whether any normalised variant states a Tier-1 emergency.

    ``variants`` is the output of ``llm._policy_variants``: the faithful
    normalisation plus its de-obfuscated siblings. Matching every variant keeps
    the evasion resistance the flat substring list had, without its collisions.
    """

    for variant in variants:
        if _boundary_hit(_TIER1_BOUNDARY, variant):
            return True
        if _boundary_hit(_SELF_HARM_BOUNDARY, variant):
            return True
        if _intent_bound_self_harm_hit(variant):
            return True
        if _ambiguous_self_harm_hit(variant):
            return True
        if _severity_bound_hit(variant):
            return True
        squashed = _squash_text(variant)
        if any(term in squashed for term in _TIER1_SQUASHED):
            return True
        if _squashed_self_harm_hit(squashed):
            return True
    return False


def _intent_bound_self_harm_hit(variant: str) -> bool:
    """Require a stated intention before an otherwise ordinary phrase escalates."""

    if not _boundary_hit(_INTENT_BOUND_SELF_HARM_BOUNDARY, variant):
        return False
    return _boundary_hit(_INTENT_VERB_BOUNDARY, variant)


def _severity_bound_hit(variant: str) -> bool:
    for index, (symptom_pattern, marker_pattern, minimum) in enumerate(_SEVERITY_COMPILED):
        if not _boundary_hit(symptom_pattern, variant):
            continue
        if not _boundary_hit(marker_pattern, variant):
            continue
        distinct = sum(
            1
            for matcher in _SEVERITY_MARKER_MATCHERS[index]
            if _boundary_hit(matcher, variant)
        )
        if distinct >= minimum:
            return True
    return False


def _ambiguous_self_harm_hit(variant: str) -> bool:
    """Resolve the ``tu van`` homophone between "tự vẫn" and "tư vấn".

    Written without diacritics both readings are the same five letters, and
    "muốn tư vấn" is the most common way visitors open this assistant. The
    reading is settled by evidence in the same turn, in this order:

    * unambiguous self-harm vocabulary nearby → crisis;
    * a consultation complement ("tư vấn về", "tư vấn dinh dưỡng") → consult;
    * a stated intention that ends the clause or is followed by a reason,
      companion or time ("tôi định tự vẫn thôi", "tự vẫn với vợ con") → crisis;
    * otherwise no escalation, so a topic question phrased in a way this table
      has not catalogued stays answerable.
    """

    if not _boundary_hit(_AMBIGUOUS_BOUNDARY, variant):
        return False
    if _boundary_hit(_CORROBORATOR_BOUNDARY, variant):
        return True
    if _boundary_hit(_CONSULT_FRAME_BOUNDARY, variant):
        return False
    # A companion phrase states the act itself ("tự vẫn cùng con"), so it does
    # not need a separate intent verb to be a decision.
    if _COMPANION_PATTERN.search(variant):
        return True
    if not _boundary_hit(_INTENT_VERB_BOUNDARY, variant):
        return False
    if _CLAUSE_FINAL_PATTERN.search(variant):
        return True
    return bool(_DECISION_CONTINUATION_PATTERN.search(variant))


def consult_frame_present(variants: tuple[str, ...] | list[str]) -> bool:
    """Expose the consultation-frame test for callers and tests."""

    return any(_boundary_hit(_CONSULT_FRAME_BOUNDARY, variant) for variant in variants)
