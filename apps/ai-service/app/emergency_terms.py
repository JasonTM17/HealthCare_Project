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
    decomposed = unicodedata.normalize("NFKD", compatibility).casefold()
    # "từ" (grave — benign "từ từ" / "from") and "tự" (nặng — self-harm
    # "tự tử") collapse to the same folded "tu". Mask the grave form while
    # accents still exist so "sẽ từ từ" cannot trip the volition-guarded
    # suicide cue but "sẽ tự tử" still escalates (Wukong FP-A).
    decomposed = decomposed.replace("tu\u031B\u0300", "tuu")
    without_diacritics = "".join(
        character
        for character in decomposed
        if not unicodedata.combining(character) and unicodedata.category(character) != "Cf"
    )
    return " ".join(without_diacritics.split())

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
    # common Vietnamese input and previously escaped every rule. The English
    # pair and "cap cuu" close the lexicon-membership gap the Java/BFF cues
    # already carried (Wukong wave-14: two-way parity merge).
    "kho tho",
    "not breathing",
    "loss of consciousness",
    "cap cuu",
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
    "yeu nua nguoi",
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
    # Seizure, coma, loss of consciousness. "co giat" itself lives in
    # _CO_GIAT_CRISIS below: folded, it collides with the amenity question
    # "có giặt (ủi/là/đồ...)" so it carries a laundry-noun exclusion.
    "dong kinh",
    "dong kinh lien tuc",
    "san giat",
    "hon me",
    "bat tinh",
    "mat y thuc",
    "ngat xiu",
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
    # Bare "axit" stays out: it collides with mainstream queries ("axit uric
    # cao", "axit folic", "axit hyaluronic"). Acid-attack and burn senses are
    # carried by the verb/location compounds below — the same set the Java
    # and BFF mirrors hold (Wukong wave-14: parity merge).
    "tat axit",
    "tung axit",
    "chem axit",
    "phun axit",
    # "do axit" stays out: it folds "độ/đồ/đo axit" so "nồng độ axit uric"
    # would over-fire — the exact mainstream collision bare "axit" carried.
    # "uong axit" also stays out of the boundary tuple: "uống axit folic/
    # uric" is a benign supplement query, so ingestion is matched only in
    # the squashed net with a supplement-name suppression (Wukong wave-14).
    "bong axit",
    "axit bong",
    "nuot axit",
    "axit vao mat",
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
    "tre sot cao",
    "sot cao khong ha",
    "tre li bi",
    "tre khong phan ung",
    # End-of-life and imminent-death phrasing.
    "tu vong",
    # "từ vong" (grave-accent typo of "tử vong") folds to "tuu vong" under
    # the benign-adverb mask — the masked twin keeps the recall (Wukong
    # wave-12 F1 bonus).
    "tuu vong",
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
    # "tu tu" is NOT here: folded, it is also the everyday adverb "từ từ"
    # (slowly). It lives in _TUTU_CRISIS below, which requires a volition or
    # thinking idiom before it ("muốn/định/tính/quyết tự tử",
    # "nghĩ (đến việc|về|tới) tự tử", "có ý (định) tự tử").
    "tu sat",
    # Joined "tusat" (5 chars, under the squash floor) — boundary-only recall,
    # identical to the Java/BFF literal alternative (Wukong wave-14).
    "tusat",
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


# "co giat" (convulsion) folds identically to "có giặt" (laundry service — a
# real amenity question this endpoint answers). It escalates only when the
# word after it is not a laundry noun ("giặt ủi/là/giũ/đồ/quần áo/khăn") or a
# "giặt cho <person>" phrase. "do" is doubly ambiguous ("giặt đồ" laundry vs
# "do" because-of), and a closed-world medical-reason allowlist cannot
# enumerate every cause — "co giật do bị ngã" must still fire. It suppresses
# only at clause end or before laundry-closing/amenity-question continuations
# ("cho khách", "thế nào", "miễn phí", "giá", "bao nhiêu", "dịch vụ", "phí");
# every other continuation keeps the fail-safe default of escalating.
_CO_GIAT_CRISIS: Final[re.Pattern[str]] = re.compile(
    r"\bco\W+giat\b"
    r"(?!\W*(?:ui|la|giu?|quan|ao|khan|cho\W+(?:khach|nguoi|benh\W*nhan|minh|toi|em|anh|chi|con|me|ba|ong))\b)"
    r"(?!\W+do\b(?:\W*$|\W+(?:khong|ko|a|ha|nhe|nhi|nho|vay|ta|dc|duoc|chu|giu|thue|o\W+dau|o\W+day"
    r"|the\W*nao|nhu\W*the\W*nao|mien\W*phi|phi|dich\W*vu|gia|bao\W*nhieu"
    r"|cho\W+(?:khach|nguoi|benh\W*nhan|minh|toi|em|anh|chi|con|me|ba|ong))\b))"
)

# "ngat" folds identically for "ngất" (faint — Tier-1) and "ngắt" (cut /
# interrupt — connectivity, electrical, speech). Bare "ngat" therefore fires
# only when the next word is not an interrupt-sense continuation; the
# exclusion is clause-local to this one candidate so a real emergency clause
# later in the same message ("ngắt kết nối rồi muốn tự tử") still escalates
# through the other cues. "ngắt hơi" (interrupted breathing) deliberately
# stays firing — "hoi" is breath, not connectivity.
_NGAT_BENIGN_CONTINUATION: Final[str] = (
    r"ket\W*noi|mach|loi|han|song|quang|dien|nguon|wifi|internet|mang"
    r"|tin\W*hieu|cuoc|am\W*thanh|bluetooth|day|camera|video|live|stream"
    r"|duong|cap|nuoc|gas|thuoc|giac|doan"
)
_NGAT_CRISIS: Final[re.Pattern[str]] = re.compile(
    r"\bngat\b(?!\W+(?:" + _NGAT_BENIGN_CONTINUATION + r")\b)"
)
# Reversed word order — "wifi bị ngắt", "mạng bị ngắt rồi": the benign
# antecedent sits BEFORE "ngat", which the forward lookahead cannot see
# (Wukong wave-12c CE5). The antecedent list is deliberately narrow —
# only unambiguous technical/utility nouns that are never common names.
# "mach" (pulse), "thuoc" (medication withdrawal) and the name-colliding
# nouns "quang" (Quang), "duong" (Dương), "doan" (Đoàn), "loi" (Lợi),
# "giac" (Giác), "cap" (Cáp), "song" (Sóng), "cuoc", "han" stay OUT so a
# faint report like "anh Quang bị ngất" still escalates (Wukong CE7);
# their forward readings ("ngắt cáp", "ngắt lời") are already covered by
# the benign-continuation lookahead. The passive marker "bị" is REQUIRED
# between antecedent and "ngat" — "Quang ngất" keeps firing — and a
# person marker immediately before the antecedent ("anh Điện", "bé Diện",
# "con Điện") blocks suppression. Markers exclude "co"/"chi"/"di"/"mo"/
# "gia" — they are also common verbs/classifiers and would reintroduce
# the false-positive the rule exists to fix. The trailing "ngat" must be
# clause-final so "wifi bị ngắt hơi" still reads the dyspnea
# continuation and fires.
# Python's re requires each lookbehind alternative to be fixed-width, so
# the marker list expands into one lookbehind per marker (identical
# semantics to the compact alternation used in Java/BFF). Wukong CE9:
# family-report terms (con/cụ/cháu/thằng/đứa/nhóc/trai/gái/nội/ngoại/cha)
# are markers too — "con Điện bị ngất" is a child faint report, not a
# power outage. "con" collides mildly with "còn" ("còn wifi bị ngắt" now
# over-fires instead of suppressing) — accepted because a missed child
# emergency is strictly worse than a benign facilities escalation.
# "ay" is deliberately absent: as a suffix-match it would also fire on
# "hay" and "dây" — "dây điện bị ngắt" (power cord) must stay suppressed.
# Team-Lead adjudication (Wukong round 5): "co"/"chi"/"gia"/"la" are
# promoted to markers despite the verb collisions — "cô <name>" and
# "chị <name>" are the highest-frequency kinship reports in a hospital,
# while "có/chỉ wifi bị ngắt" are loose typings whose false-positive
# price is strictly safer than a missed faint report. Occupational and
# family descriptors (học/sinh/viên/tá/sư/nữ/khách) close the remaining
# common shapes; the open tail beyond is enumerable-by-construction.
_NGAT_PERSON_MARKER_LOOKBEHINDS: Final[str] = (
    r"(?<!anh )(?<!em )(?<!ong )(?<!ba )(?<!ban )(?<!thay )(?<!chu )"
    r"(?<!me )(?<!bo )(?<!ten )(?<!nguoi )(?<!nhan )(?<!be )(?<!cau )"
    r"(?<!bac )(?<!si )(?<!con )(?<!cu )(?<!chau )(?<!thang )(?<!dua )"
    r"(?<!nhoc )(?<!trai )(?<!gai )(?<!noi )(?<!ngoai )(?<!cha )"
    r"(?<!nho )(?<!than )(?<!benh )(?<!yeu )(?<!di )(?<!mo )(?<!dau )"
    r"(?<!re )(?<!xa )(?<!vo )(?<!chong )(?<!chang )(?<!nang )(?<!nien )"
    r"(?<!co )(?<!chi )(?<!gia )(?<!la )(?<!hoc )(?<!sinh )(?<!vien )"
    r"(?<!ta )(?<!su )(?<!nu )(?<!khach )"
)
_NGAT_BENIGN_ANTECEDENT: Final[str] = (
    r"wifi|internet|ket\W*noi|mang|tin\W*hieu|bluetooth|camera|video|live"
    r"|stream|nuoc|gas|nguon|day|am\W*thanh|dien"
)
_NGAT_REVERSED_CLOSER: Final[str] = (
    r"roi|lai|xong|lam|la|vay|thoi|thui|a|ha|nhe|nhi|ma|rui|ua|ho|ko|khong"
    r"|dc|duoc|nua"
)
_NGAT_BENIGN_REVERSED: Final[re.Pattern[str]] = re.compile(
    r"\b" + _NGAT_PERSON_MARKER_LOOKBEHINDS
    + r"(?:" + _NGAT_BENIGN_ANTECEDENT + r")"
    r"\W+(?:(?:vua|dang|hay|cu|lien\W+tuc|thuong\W*xuyen|bi)\W+)*bi\W+"
    r"ngat\b(?=\W*(?:$|(?:" + _NGAT_REVERSED_CLOSER + r")\b))"
)


def _ngat_crisis_hit(text: str) -> bool:
    """Return whether an unsuppressed "ngat" crisis candidate fires.

    Forward-benign continuations are already excluded inside ``_NGAT_CRISIS``;
    this layer additionally drops candidates whose interrupt-sense antecedent
    precedes them ("wifi bị ngắt"). Suppression stays occurrence-local so a
    second, genuine "ngất"/"ngắt hơi" clause in the same message still fires.
    """

    suppressed_ends = ngat_suppressed_ends(text)
    return any(
        match.end() not in suppressed_ends for match in _NGAT_CRISIS.finditer(text)
    )


def ngat_suppressed_ends(text: str) -> frozenset[int]:
    """End offsets of "ngat" occurrences covered by a benign antecedent.

    Shared with ``llm._emergency_phrase_hit`` so the phrase-pattern ngat
    alternative honours the same reversed-order suppression.
    """

    return frozenset(match.end() for match in _NGAT_BENIGN_REVERSED.finditer(text))

# Spaced "tu tu" is both "tự tử" (self-harm) and the everyday adverb
# "từ từ" (slowly). It escalates only behind a volition or thinking idiom;
# the concatenated "tutu" keeps its own benign-continuation disambiguation.
# The nghi idiom skips "nghỉ ngơi" (rest slowly) — "nghi ngoi tu tu" is
# benign; "nghi (đến việc|về|tới) tu tu" is not.
# Masked "từ" (tuu) tokens and the connector "rồi" may legitimately sit
# between the volition anchor and the crisis phrase: "sẽ từ từ tự tử" and
# "sẽ từ từ rồi tự tử" must still escalate even though "sẽ từ từ" alone
# must not (Wukong wave-12 F1).  The gap is deliberately bounded — only
# masked-adverb tokens and "roi" — so a distant ambiguous "tu tu" in an
# unrelated clause does not reattach to an earlier "sẽ".
_TUTU_CRISIS: Final[re.Pattern[str]] = re.compile(
    r"\b(?:(?:muon|dinh|tinh|quyet|se|sap|dang)\W+(?:(?:tuu|roi)\W+)*tu\W+tu"
    r"|nghi\W+(?!ngoi\b)(?:den\W+(?:viec\W+)?|ve\W+|toi\W+)?(?:(?:tuu|roi)\W+)*tu\W+tu"
    r"|co\W+y\W+(?:dinh\W+)?(?:(?:tuu|roi)\W+)*tu\W+tu)\b"
)

_TIER1_BOUNDARY = _compile_boundary_matcher(TIER1_TERMS)
_SELF_HARM_BOUNDARY = _compile_boundary_matcher(SELF_HARM_TERMS)
_INTENT_BOUND_SELF_HARM_BOUNDARY = _compile_boundary_matcher(INTENT_BOUND_SELF_HARM_TERMS)
_INTENT_VERB_BOUNDARY = _compile_boundary_matcher(SELF_HARM_INTENT_VERBS)
_AMBIGUOUS_BOUNDARY = _compile_boundary_matcher(AMBIGUOUS_SELF_HARM_TERMS)
_CORROBORATOR_BOUNDARY = _compile_boundary_matcher(SELF_HARM_CORROBORATORS)
_CONSULT_FRAME_BOUNDARY = _compile_boundary_matcher(CONSULT_FRAME_TERMS)

# "cogiat" is appended by hand after leaving TIER1_TERMS for the laundry
# collision. A laundry noun still follows it in the squash stream
# ("cogiatui..." = "có giặt ủi"), so _squashed_tier1_hit re-applies the
# same exclusion as _CO_GIAT_CRISIS instead of matching it bare.
# "uongaxit" joins "cogiat" as a hand-added squashed term: the spaced term
# left the boundary tuple (supplement collision), and
# _squashed_tier1_hit re-applies a supplement-name suppression per
# occurrence instead of matching it bare.
_TIER1_SQUASHED = (
    *_compile_squash_matcher(TIER1_TERMS),
    "cogiat",
    "uongaxit",
    "uongnhamaxit",
)
# Joined "tutu" keeps the same contract as spaced "tu tu": it only counts
# behind a volition/thinking marker. Bare "tutu" inside a squash stream
# cannot be told apart from benign "từ từ" mid-sentence ("ditutu" =
# "đi từ từ"), and the old next-character continuation check only ever
# resolved word-openings like "tutuc"/"tutuong" — never that case.
_SELF_HARM_SQUASHED = (
    *_compile_squash_matcher(SELF_HARM_TERMS),
    "muontutu",
    "dinhtutu",
    "tinhtutu",
    "quyettutu",
    "setutu",
    "saptutu",
    "dangtutu",
    "nghitutu",
    "nghidentutu",
    "nghidenviectutu",
    "nghivetutu",
    "nghitoitutu",
    "coytutu",
    "coydinhtutu",
)

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


# Benign words that open with "tutu": "tự túc", "tư tưởng", "túi tiền",
# "tuỳ", "tùng". Any other continuation at stream start reads as joined
# self-harm ("tututroi").
_TUTU_BENIGN_CONTINUATIONS: Final[frozenset[str]] = frozenset("conjuy")


def _squashed_self_harm_hit(squashed: str) -> bool:
    if any(term in squashed for term in _SELF_HARM_SQUASHED):
        return True
    # Bare "tutu" is only trusted at the very start of the message stream:
    # mid-stream it cannot be told apart from benign "từ từ" ("ditutu" =
    # "đi từ từ"), and intent compounds already cover the marked cases.
    # A "th" continuation ("tututhoi" = "từ từ thôi") is also benign.
    return (
        squashed.startswith("tutu")
        and squashed[4:5] not in _TUTU_BENIGN_CONTINUATIONS
        and squashed[4:6] != "th"
    )


def emergency_hit(variants: tuple[str, ...] | list[str]) -> bool:
    """Return whether any normalised variant states a Tier-1 emergency.

    ``variants`` is the output of ``llm._policy_variants``: the faithful
    normalisation plus its de-obfuscated siblings. Matching every variant keeps
    the evasion resistance the flat substring list had, without its collisions.
    """

    for variant in variants:
        if _boundary_hit(_TIER1_BOUNDARY, variant):
            return True
        if _CO_GIAT_CRISIS.search(variant):
            return True
        if _ngat_crisis_hit(variant):
            return True
        if _TUTU_CRISIS.search(variant):
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
        if _squashed_tier1_hit(squashed):
            return True
        if _squashed_self_harm_hit(squashed):
            return True
    return False


def self_harm_hit(variants: tuple[str, ...] | list[str]) -> bool:
    """Return whether the crisis signal is specifically a self-harm statement.

    Runs the self-harm lanes of ``emergency_hit`` only — physical tier-1
    terms, convulsions, fainting and severity-escalated symptoms stay out.
    Callers use this to pick the dedicated crisis wording; it never widens
    or narrows detection itself.
    """

    for variant in variants:
        if _TUTU_CRISIS.search(variant):
            return True
        if _boundary_hit(_SELF_HARM_BOUNDARY, variant):
            return True
        if _intent_bound_self_harm_hit(variant):
            return True
        if _ambiguous_self_harm_hit(variant):
            return True
        if _squashed_self_harm_hit(_squash_text(variant)):
            return True
    return False


# "do" is doubly ambiguous in squash ("đồ" laundry vs "do" because-of), and
# Inside a squash stream there is no \b, so prefix matching is unsafe: "la"
# would swallow "cogiatlai" (co giật lại) and "ta" would swallow
# "cogiatdotainan" (do tai nạn) — Wukong wave-11 CE1/CE2. Suppression is
# only allowed when the ENTIRE remainder is a chain of laundry units and/or
# closing particles: "cogiatuikhong" (giặt ủi không), "cogiatdo" (giặt đồ),
# "cogiatdokhongvay" stay quiet; any leftover non-particle residue — "lai",
# "tainan", "binga" — fails the full-match and fires.
# Bare "gi" is allowed only in FIRST position ("cogiatgi" = giặt gì,
# benign); in a continuation it is reason-capable ("do gì" = because of
# what) so the chain requires the full "giu" (giũ) there instead. A
# "cho<person>" unit is allowed in first position too ("cogiatchokhach" =
# có giặt cho khách); the other amenity-question units ("phi", "gia",
# "thenao", "baonhieu", "dichvu", "mienphi") only count after a laundry
# noun so a bare ambiguous continuation cannot silently suppress. Bare
# "tien" is deliberately NOT a unit — "cogiatdotien" could be a convulsion
# lead-in ("do tiền sử" = because of history) so it stays fail-safe like
# the spaced "co giat do tien" (Wukong wave-12c CE4); the price compounds
# "baonhieutien"/"giatien"/"phitien" carry the benign readings instead.
_CO_GIAT_PERSON_TAIL: Final[str] = (
    r"cho(?:khach|nguoi|benhnhan|minh|toi|em|anh|chi|con|me|ba|ong)"
)
_CO_GIAT_SQUASHED_SUPPRESS: Final[re.Pattern[str]] = re.compile(
    r"(?:ui|la|giu?|quan|ao|khan|do|" + _CO_GIAT_PERSON_TAIL + r")"
    r"(?:ui|la|giu|quan|ao|khan|do|khong|ko|ha|nhe|nhi|nho|vay|ta|dc|duoc|chu|thue|oday|odau"
    r"|" + _CO_GIAT_PERSON_TAIL + r"|thenao|nhuthenao|mienphi|phitien|phi|dichvu|giatien|gia"
    r"|baonhieutien|baonhieu)*\Z"
)


# Benign acid names that follow "uongaxit"/"uong axit": supplement and lab
# queries ("uống axit folic/uric/béo") must not read as acid ingestion.
# Dangerous acids (sulfuric, nitric, hydrochloric, formic, acetic, boric,
# benzoic) deliberately stay out — those ingestions fire. The tuple is
# exported so app.llm._EMERGENCY_PHRASE_PATTERN can reuse the same names
# for its spaced "uong axit" alternative.
UONG_AXIT_BENIGN_ACID_NAMES: Final[tuple[str, ...]] = (
    "folic", "uric", "hyaluronic", "salicylic", "acetylsalicylic",
    "ascorbic", "beo", "amino", "citric", "lipoic", "linoleic",
    "oleic", "retinoic", "pantothenic", "nicotinic", "glutamic",
    "aspartic", "nucleic",
)
# Prefix match, no trailing boundary: inside a squash stream the benign
# name continues straight into the next word ("uongaxitfolickhi").
_UONG_AXIT_BENIGN_ACID: Final[re.Pattern[str]] = re.compile(
    "(?:" + "|".join(UONG_AXIT_BENIGN_ACID_NAMES) + ")"
)


# "uống axit" ingestion prefixes in the squash stream — the bare and the
# mistaken-swallow ("uống nhầm axit") shapes share one benign-acid gate.
_UONG_AXIT_PREFIXES: Final[tuple[str, ...]] = ("uongaxit", "uongnhamaxit")


def _uong_axit_unsuppressed(squashed: str, term: str) -> bool:
    """True when a ``term`` occurrence lacks a benign acid tail."""

    start = squashed.find(term)
    while start != -1:
        rest = squashed[start + len(term) :]
        if not _UONG_AXIT_BENIGN_ACID.match(rest):
            return True
        start = squashed.find(term, start + 1)
    return False


def _squashed_tier1_hit(squashed: str) -> bool:
    for term in _TIER1_SQUASHED:
        if term in _UONG_AXIT_PREFIXES:
            if term in squashed and _uong_axit_unsuppressed(squashed, term):
                return True
            continue
        if term != "cogiat":
            if term in squashed:
                return True
            continue
        start = squashed.find(term)
        while start != -1:
            rest = squashed[start + len(term) :]
            if rest and _CO_GIAT_SQUASHED_SUPPRESS.match(rest):
                start = squashed.find(term, start + 1)
                continue
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
