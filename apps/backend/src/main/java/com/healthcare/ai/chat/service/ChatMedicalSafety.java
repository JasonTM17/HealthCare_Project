package com.healthcare.ai.chat.service;

import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;

import java.text.Normalizer;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/** Spring persist-time diagnose/prescribe reject. FastAPI regex is not sufficient. */
public final class ChatMedicalSafety {

    private static final Pattern UNSAFE_CLAIM = Pattern.compile(
        "(chan\\s*doan\\s*(la|toi)|diagnosed as|i diagnose|ke\\s*don|prescribe|prescription|"
            + "lieu\\s*thuoc|uong\\s+\\d+(?:[.,]\\d+)?\\s*(?:mg|ml|vien)|"
            + "(?:take|use)\\s+\\d+(?:[.,]\\d+)?\\s*(?:mg|ml|pills?|tablets?)|"
            + "you\\s+should\\s+(?:take|use)|ngung\\s+thuoc|stop medication)",
        Pattern.CASE_INSENSITIVE
    );
    /** A refusal frame before a claim ("không thể chẩn đoán") makes the claim safe. */
    private static final Pattern NEGATION_FRAME = Pattern.compile(
        "\\b(?:khong|ko|cannot|can not|can t|don t|do not|does not|did not|"
            + "must not|should not|will not|would not)\\b",
        Pattern.CASE_INSENSITIVE
    );
    private static final String REFUSAL_MODIFIERS =
        "(?:(?:the|duoc phep|duoc|nen|tu y|dua ra|cung cap|thuc hien|to|"
            + "provide|give|offer|a|an|any)\\s+)*";
    private static final String REFUSAL_CLINICAL_VERB =
        "(?:chan doan|diagnose|ke don|prescribe|prescription|lieu thuoc|"
            + "ngung thuoc|stop medication|thay doi thuoc)";
    private static final Pattern DIRECT_REFUSAL_GAP = Pattern.compile(
        "\\s*" + REFUSAL_MODIFIERS,
        Pattern.CASE_INSENSITIVE
    );
    // A refusal can enumerate clinical verbs; unrelated reassurance cannot
    // extend its scope to a later instruction or asserted diagnosis.
    private static final Pattern REFUSAL_LIST_GAP = Pattern.compile(
        "\\s*" + REFUSAL_MODIFIERS
            + "(?:" + REFUSAL_CLINICAL_VERB + "\\s+(?:va|hoac|or|and)\\s+)*",
        Pattern.CASE_INSENSITIVE
    );
    // A comma-only middle item needs a complete verb-only enumeration. Drugs,
    // doses and imperative tails cannot inherit a previous clinical refusal.
    private static final Pattern REFUSAL_ENUMERATION = Pattern.compile(
        "\\s*" + REFUSAL_MODIFIERS + REFUSAL_CLINICAL_VERB
            + "(?:\\s+" + REFUSAL_CLINICAL_VERB + ")*"
            + "\\s+(?:va|hoac|or|and)\\s+" + REFUSAL_CLINICAL_VERB + "\\s*",
        Pattern.CASE_INSENSITIVE
    );
    private static final Pattern ASSERTED_CLAIM = Pattern.compile(
        "^(?:chan\\s*doan\\s*(?:la|toi)|diagnosed as|i diagnose|uong|take|use|you\\s+should)",
        Pattern.CASE_INSENSITIVE
    );
    /** Vehicle compounds that excuse {@code dau} as "đậu/đỗ" (to park). */
    private static final String VEHICLE_CUE =
        "xe\\s+(?:may|dap|tay\\s+ga|tai|buyt|bus|khach|hoi|om|dien|ba\\s+gac)"
            + "|xe|oto|o\\s*to|moto|mo\\s*to";
    /**
     * Body-part words.  Deliberately excludes {@code co}/{@code tai}/{@code da}
     * — those collide with common particles ("đậu xe có mất phí", "đậu xe tại
     * đâu", "đậu xe đã xong") and would re-protect real parking questions.
     */
    private static final String BODY_PART_CUE =
        "nguc|bung|lung|hong|mat|tay|chan|tim|than|xuong|khop|nao"
            + "|ban\\s+(?:chan|tay)|that\\s+lung|vai|goi|mong|nguoi|minh"
            + "|rang|mui|mieng|mom|hach|khoeo|ngon|nhuc";
    private static final Pattern PROTECTED_INPUT_CUE = Pattern.compile(
        "(?<![a-z0-9])(?:(?<!(?<![a-z0-9])(?:o|vao|bai|nha|san|khu"
            + "|xe|oto|o to|moto|mo to|xe may|xe dap|xe tay ga"
            + "|xe tai|xe buyt|xe bus|xe hoi|xe om|xe dien"
            + "|xe ba gac|xe khach) )(?:dau)"
            + "(?!\\s+(?>(?:" + VEHICLE_CUE + "))\\b"
            + "(?!\\s+(?:" + BODY_PART_CUE + ")\\b))|dau\\s+(?:(?>"
            + VEHICLE_CUE + ")\\s+)?(?:" + BODY_PART_CUE + ")|kho\\s+tho|"
            // "ngat" (ngất/ngắt fold collision) is evaluated outside this
            // alternation by ngatCrisisHit — the same benign-continuation
            // and reversed-antecedent suppression the emergency cue uses,
            // applied to the protected lane so connectivity questions still
            // reach the amenity/navigator classifiers (Wukong wave-12c CE5).
            + "sot"
            + "|co\\s+giat(?!\\W*(?:ui|la|giu?|quan|ao|khan|cho\\W+(?:khach|nguoi|benh\\W*nhan|minh|toi|em|anh|chi|con|me|ba|ong))\\b)"
            + "(?!\\W*do\\b(?:\\W*$|\\W+(?:khong|ko|a|ha|nhe|nhi|nho|vay|ta|dc|duoc|chu|giu|thue|o\\W+dau|o\\W+day"
            + "|the\\W*nao|nhu\\W*the\\W*nao|mien\\W*phi|phi|dich\\W*vu|gia|bao\\W*nhieu"
            + "|cho\\W+(?:khach|nguoi|benh\\W*nhan|minh|toi|em|anh|chi|con|me|ba|ong))\\b))"
            + "|chay\\s+mau|"
            // Same volition/thinking-idiom guard shape as EMERGENCY_INPUT_CUE,
            // including its bounded masked-"từ"/"rồi" gap — folded "từ từ"
            // (slowly) must not mark input clinically-protected, but masked
            // tokens between the anchor and a real "tu tu" must not hide the
            // protection either. The joined/squashed coverage below stays a
            // curated subset here: the PROTECTED cue is a routing hint, while
            // the full squash-stream parity lives on the EMERGENCY boundary.
            + "(?:(?:muon|dinh|tinh|quyet|se|sap|dang)\\s+(?:(?:tuu|roi)\\s+)*tu\\s+tu"
            + "|nghi\\s+(?!ngoi\\b)(?:den\\s+(?:viec\\s+)?|ve\\s+|toi\\s+)?(?:(?:tuu|roi)\\s+)*tu\\s+tu"
            + "|co\\s+y\\s+(?:dinh\\s+)?(?:(?:tuu|roi)\\s+)*tu\\s+tu)|chan\\s+doan|ke\\s+don|"
            + "(?:uong|dung|mua|ke|don|tiem|boi|chich|xit|giam|tang|ngung|cat|pha)\\s+thuoc|"
            + "(?<!(?<![a-z0-9])(?:nha|quay|hang) )thuoc(?!\\s+(?:khoa|co\\s+so|benh\\s+vien|thanh\\s+pho)\\b)|"
            + "lieu\\s+thuoc|trieu\\s+chung|non|tieu\\s+chay|chong\\s+mat|"
            + "mat\\s+ngu|bi\\s+ho|ho\\s+keo\\s+dai|cap\\s+cuu|"
            + "dot\\s+quy|tai\\s+bien(?:\\s+mach\\s+mau\\s+nao)?|stroke|"
            + "dotquy|taibien|capcuu|"
            + "heart\\s+attack|cardiac\\s+arrest|chest\\s+pain|shortness\\s+of\\s+breath|"
            + "difficulty\\s+breathing|cant\\s+breathe|cannot\\s+breathe|not\\s+breathing|"
            + "severe\\s+bleeding|unresponsive|collapsed|sudden\\s+collapse|"
            + "loss\\s+of\\s+consciousness|nhoi\\s+mau\\s+co\\s+tim|ngung\\s+tim|"
            + "ngung\\s+tho|bat\\s+tinh|mat\\s+y\\s+thuc|"
            + "heartattack|cardiacarrest|chestpain|shortnessofbreath|difficultybreathing|"
            + "cantbreathe|cannotbreathe|notbreathing|severebleeding|suddencollapse|"
            + "lossofconsciousness|nhoimauco\\s+tim|ngungtim|ngungtho|battinh|matythuc|"
            + "suicide|suicidal|kill\\s+myself|end\\s+my\\s+life|want\\s+to\\s+die|self\\s+harm|"
            // Squash streams have no \b — suppression must consume the whole
            // remainder as a laundry/particle chain, else "cogiatlai" (co
            // giật lại) would silently suppress (Wukong wave-11). The unit
            // lists mirror CO_GIAT_SQUASHED_SUPPRESS exactly — including the
            // "cho<person>" and amenity-fee continuations — so a joined
            // laundry-for-person question is not marked protected and can
            // still reach the amenity lane (Wukong wave-12c CE2).
            + "tutu|cogiat(?!(?:(?:ui|la|giu?|quan|ao|khan|do"
            + "|cho(?:khach|nguoi|benhnhan|minh|toi|em|anh|chi|con|me|ba|ong))"
            + "(?:ui|la|giu|quan|ao|khan|do|khong|ko|ha|nhe|nhi|nho|vay|ta|dc|duoc|chu|thue|oday|odau"
            + "|cho(?:khach|nguoi|benhnhan|minh|toi|em|anh|chi|con|me|ba|ong)"
            + "|thenao|nhuthenao|mienphi|phitien|phi|dichvu|giatien|gia|baonhieutien|baonhieu)*)(?![a-z0-9]))[a-z0-9]*)"
            + "(?![a-z0-9])",
        Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );
    public static final int EMERGENCY_SCAN_LIMIT = 4096;
    private static final Pattern EMERGENCY_INPUT_CUE = Pattern.compile(
        "(?<![a-z0-9])(?:dot\\s+quy|tai\\s+bien(?:\\s+mach\\s+mau\\s+nao)?|"
            + "stroke|cap\\s+cuu|dau\\s+nguc\\s+du\\s+doi|dau\\s+nguc\\s+lan(?:\\s+ra)?\\s+tay|"
            + "kho\\s+tho(?:\\s+du\\s+doi)?|meo\\s+mieng|yeu\\s+nua\\s+nguoi|ho\\s+ra\\s+mau|"
            // "co giat" (convulsion) must not fire on the amenity question
            // "co giat ui/la/..." (laundry service) — same spelling after
            // diacritic folding, so the exclusion list follows the word.
            // "do" is doubly ambiguous: "giặt đồ" (laundry) and "do" (because
            // of). Rather than enumerate medical reasons (a closed-world list
            // Wukong falsified — "co giật do bị ngã" stayed suppressed), "do"
            // suppresses only at clause end or before laundry-closing words;
            // every other continuation keeps the fail-safe default of firing.
            + "co\\s+giat(?!\\W*(?:ui|la|giu?|quan|ao|khan|cho\\W+(?:khach|nguoi|benh\\W*nhan|minh|toi|em|anh|chi|con|me|ba|ong))\\b)"
            + "(?!\\W*do\\b(?:\\W*$|\\W+(?:khong|ko|a|ha|nhe|nhi|nho|vay|ta|dc|duoc|chu|giu|thue|o\\W+dau|o\\W+day"
            + "|the\\W*nao|nhu\\W*the\\W*nao|mien\\W*phi|phi|dich\\W*vu|gia|bao\\W*nhieu"
            + "|cho\\W+(?:khach|nguoi|benh\\W*nhan|minh|toi|em|anh|chi|con|me|ba|ong))\\b))"
            + "|heart\\s+attack|cardiac\\s+arrest|chest\\s+pain|"
            + "shortness\\s+of\\s+breath|difficulty\\s+breathing|cant\\s+breathe|"
            + "cannot\\s+breathe|not\\s+breathing|severe\\s+bleeding|unresponsive|"
            + "collapsed|sudden\\s+collapse|loss\\s+of\\s+consciousness|"
            + "nhoi\\s+mau\\s+co\\s+tim|ngung\\s+tim|ngung\\s+tho|bat\\s+tinh|"
            + "mat\\s+y\\s+thuc|dotquy|taibien|capcuu|heartattack|cardiacarrest|chestpain|"
            + "shortnessofbreath|difficultybreathing|cantbreathe|cannotbreathe|notbreathing|"
            + "severebleeding|suddencollapse|lossofconsciousness|nhoimauco\\s+tim|ngungtim|"
            + "ngungtho|battinh|matythuc|suicide|suicidal|kill\\s+myself|end\\s+my\\s+life|"
            // "ngất"/"ngắt" is evaluated outside this alternation by
            // ngatCrisisHit — the same benign-continuation lookahead plus the
            // reversed-antecedent suppression ("wifi bị ngắt") it shares with
            // the protected lane; "ngắt hơi" keeps firing in both
            // (Wukong wave-12c CE5).
            + "want\\s+to\\s+die|self\\s+harm|"
            // "tu tu" folds identically to the benign adverb "từ từ"
            // (slowly), so the spaced form only counts as self-harm when a
            // volition/thinking idiom precedes it ("muốn/định/tính/quyết tự
            // tử", "nghĩ (đến việc|về|tới) tự tử", "có ý (định) tự tử"); the
            // concatenated "tutu" and unambiguous phrases keep full recall.
            // Masked "từ" (tuu) tokens and the connector "rồi" may sit
            // between the anchor and the final "tu tu": "sẽ từ từ tự tử"
            // and "sẽ từ từ rồi tự tử" must still escalate even though
            // "sẽ từ từ" alone must not (Wukong wave-12 F1). The gap stays
            // bounded so a distant ambiguous "tu tu" cannot reattach.
            + "(?:(?:muon|dinh|tinh|quyet|se|sap|dang)\\s+(?:(?:tuu|roi)\\s+)*tu\\s+tu"
            + "|nghi\\s+(?!ngoi\\b)(?:den\\s+(?:viec\\s+)?|ve\\s+|toi\\s+)?(?:(?:tuu|roi)\\s+)*tu\\s+tu"
            + "|co\\s+y\\s+(?:dinh\\s+)?(?:(?:tuu|roi)\\s+)*tu\\s+tu)|tu\\s+sat|muon\\s+chet|"
            // "tử vong" (death) plus the masked-accent typo twin "từ vong"
            // (tuu vong) — parity with the ai-service tier-1 terms.
            + "khong\\s+muon\\s+song|tu\\s+vong|tuu\\s+vong|"
            // Joined "tutu" counts when it opens a token and does not continue
            // into a benign word ("tutuc", "tutuong"). This fires at any token
            // start mid-message — broader than the ai-service squash rule,
            // which only trusts bare "tutu" at stream start; the direction is
            // over-fire (safe side).
            + "tutu(?![conjuy]|th)[a-z0-9]*|tusat|muonchet|khongmuonsong)"
            + "(?![a-z0-9])",
        Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );
    /**
     * Squashed-stream emergency nets mirroring ai-service
     * emergency_terms._squashed_tier1_hit/_squashed_self_harm_hit: the
     * normalized message is fully squashed (separators removed) and each
     * term matches as a substring anywhere in the stream — the same way
     * the Python engine reads joined typings, so "dangtutu", "tacogiat",
     * "khotho" or "ngatxiu" cannot slip the degraded window (Wukong
     * wave-12 F2). These alternations are generated mirrors of
     * _TIER1_SQUASHED/_SELF_HARM_SQUASHED minus "cogiat" (handled by the
     * remainder rule below) and bare "tutu" (ai-service trusts it only at
     * stream start — mid-stream "ditutu" = "đi từ từ" is benign).
     */
    private static final Pattern EMERGENCY_SQUASHED_TIER1 = Pattern.compile(
        "(?:anaphylactic|anaphylaxis|battinh|baubidaubung|bebobu|bleedingheavily|"
            + "bongdo|bongsau|breathingdifficulty|cannotbreathe|cantbreathe|"
            + "cardiacarrest|chanthuongdau|chanthuongsonao|chaymauamdao|"
            + "chaymaukhongcam|chaymaukhongngung|chaymauoat|chestpain|chetduoi|"
            + "choking|collapsed|convulsion|cothatthanhquan|coughingupblood|"
            + "criticalcondition|daunguc|daunguclanratay|daunguclantay|"
            + "dausauxuonguc|dautim|dauxuonguc|diengiat|difficultybreathing|"
            + "dingoairamau|diungnang|dongkinh|dongkinhlientuc|dotquy|drowned|"
            + "duoinuoc|facedrooping|fainted|gasping|giamcudongthai|heartattack|"
            + "heavybleeding|heavybreathing|hoachat|horamau|khongnoiduoc|"
            + "khongthoduoc|khongthonoi|khotho|khothodudoi|lietchan|lietmotben|"
            + "lietnuanguoi|liettay|mangthaibiramau|mangthairamau|matthiluc|"
            + "matythuc|meomieng|miengbimeo|mohoilanh|moimeo|momatdotngot|"
            + "nangnguc|ngattho|ngatxiu|nghetho|nghettho|ngodoc|ngungtho|"
            + "ngungtim|nguyhiemtinhmang|nguykich|nhaubongnon|nhoimaucotim|"
            + "nhoimautim|noikho|noikhongro|noingong|nonramau|"
            + "numbnessononeside|overdose|overdosed|paraquat|pesticide|phanve|"
            + "phumoi|poisoned|poisoning|qualieu|qualieuthuoc|retrosternal|"
            + "sangiat|sapchet|sauxuonguc|saythai|seizure|severebleeding|"
            + "shortnessofbreath|slurredspeech|socphanve|sotcaokhongha|"
            + "sotxuathuyet|stroke|suddencollapse|suddenweakness|sungmoi|"
            + "taibien|taibienmachmaunao|tainangiaothong|temotben|tenuanguoi|"
            + "thaikhongmay|thailuu|thaingoaitucung|thatnguc|thokhokhan|"
            + "thoplom|thorit|thorut|thuocdietco|thuoctay|tiensangiat|"
            + "tieuramau|timtai|trebobu|trekhongchiuan|trekhongphanung|"
            + "trekhotho|trelibi|tresotcao|tretimtai|troublebreathing|trungdoc|"
            + "tucnguc|tuvong|tuuvong|unconscious|unresponsive|uongaxit|"
            + "uonghoachat|uongthuocdoc|uongthuocngu|uongthuoctay|"
            + "vamohoilanh|vangmohoilanh|vanmohoilanh|vomitingblood|"
            + "xuathuyet|xuathuyetnao|xuathuyettieuhoa|xuonguc|yeuliet)"
    );
    private static final Pattern EMERGENCY_SQUASHED_SELF_HARM = Pattern.compile(
        "(?:betteroffdead|bienmatkhoithegioi|cantgoon|catcotay|cattay|"
            + "chancuocsong|chansong|chetdi|coydinhtutu|coytutu|cutmyself|"
            + "dangtutu|dinhtutu|donotwanttolive|dontwanttolive|enditall|"
            + "endmylife|hurtmyself|jumpoffabridge|jumpoffabuilding|"
            + "ketlieucuocdoi|ketlieucuocsong|ketthuccuocdoi|ketthuccuocsong|"
            + "khongconlydodesong|khongconlydosong|khongconmuonsong|"
            + "khongmuonodaynua|khongmuonsong|khongmuonsongnua|killme|"
            + "killmyself|muonchet|muonchetdi|muontutu|nghidentutu|"
            + "nghidenviectutu|nghingoivinhvien|nghitoitutu|nghitutu|"
            + "nghivetutu|nhaycau|nhaylau|noreasontolive|notwanttobealive|"
            + "notworthliving|quyettutu|rachtay|radimaimai|saptutu|selfharm|"
            + "setutu|sleepforever|suicidal|suicide|takemyownlife|tinhtutu|"
            + "treoco|tuhuyhoai|tuketlieu|tulamdau|unalive|wannadie|wanttodie|"
            + "wishiwasdead|wishiweredead)"
    );
    /**
     * Squashed "cogiat" suppression — fullmatch mirror of ai-service
     * _CO_GIAT_SQUASHED_SUPPRESS: the remainder after "cogiat" must consume
     * entirely as laundry units / closing particles, else it fires
     * ("cogiatdokhong" quiet; "cogiatlai"/"cogiatdobinga" fire).
     */
    // Bare "tien" is deliberately not a unit — "cogiatdotien" could be a
    // convulsion lead-in ("do tiền sử" = because of history) so it stays
    // fail-safe like spaced "co giat do tien" (Wukong wave-12c CE4); the
    // price compounds "baonhieutien"/"giatien"/"phitien" carry the benign
    // readings.
    private static final Pattern CO_GIAT_SQUASHED_SUPPRESS = Pattern.compile(
        "(?:ui|la|giu?|quan|ao|khan|do|cho(?:khach|nguoi|benhnhan|minh|toi|em|anh|chi|con|me|ba|ong))"
            + "(?:ui|la|giu|quan|ao|khan|do|khong|ko|ha|nhe|nhi|nho|vay|ta|dc|duoc|chu|thue|oday|odau"
            + "|cho(?:khach|nguoi|benhnhan|minh|toi|em|anh|chi|con|me|ba|ong)"
            + "|thenao|nhuthenao|mienphi|phitien|phi|dichvu|giatien|gia|baonhieutien|baonhieu)*\\z"
    );
    private static final Pattern SQUASHED_COGIAT = Pattern.compile("cogiat");
    /** Mirror of ai-service _TUTU_BENIGN_CONTINUATIONS (frozenset chars). */
    private static final String TUTU_BENIGN_CONTINUATIONS = "conjuy";
    /**
     * "ngat" folds "ngất" (faint) and "ngắt" (interrupt/disconnect) together.
     * Shared by the protected and emergency cues: a benign-continuation
     * lookahead keeps connectivity/electrical/speech questions out of both
     * lanes — "ngắt hơi" stays firing because "hoi" is breath.
     */
    private static final Pattern NGAT_CRISIS = Pattern.compile(
        "(?<![a-z0-9])ngat\\b(?!\\s+(?:ket\\s*noi|mach|loi|han|song|quang|dien|nguon|wifi|internet|mang"
            + "|tin\\s*hieu|cuoc|am\\s*thanh|bluetooth|day|camera|video|live|stream"
            + "|duong|cap|nuoc|gas|thuoc|giac|doan)\\b)",
        Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );
    /**
     * Reversed word order — "wifi bị ngắt", "mạng bị ngắt rồi": the benign
     * antecedent sits BEFORE "ngat", which the forward lookahead cannot
     * see (Wukong wave-12c CE5). The antecedent list is deliberately
     * narrow — only unambiguous technical/utility nouns that are never
     * common names. "mach" (pulse), "thuoc" (medication withdrawal) and
     * the name-colliding nouns "quang" (Quang), "duong" (Dương), "doan"
     * (Đoàn), "loi" (Lợi), "giac" (Giác), "cap" (Cáp), "song" (Sóng),
     * "cuoc", "han" stay OUT so a faint report like "anh Quang bị ngất"
     * still escalates (Wukong CE7); their forward readings are already
     * covered by the benign-continuation lookahead. The passive marker
     * "bị" is REQUIRED between antecedent and "ngat" — "Quang ngất"
     * keeps firing — and a person marker immediately before the
     * antecedent ("anh Điện", "bé Diện", "con Điện") blocks suppression.
     * Family-report terms (con/cụ/cháu/thằng/đứa/nhóc/trai/gái/nội/ngoại/
     * cha) are markers too — "con Điện bị ngất" is a child faint report,
     * not a power outage (Wukong CE9); "con" collides mildly with "còn"
     * and is accepted because a missed child emergency is strictly worse
     * than a benign facilities escalation. Markers exclude "co"/"chi"/
     * "di"/"mo"/"gia" — they are also common verbs/classifiers and would
     * reintroduce the false-positive the rule exists to fix. The
     * trailing "ngat" must be clause-final so
     * "wifi bị ngắt hơi" still reads the dyspnea continuation.
     */
    private static final Pattern NGAT_BENIGN_REVERSED = Pattern.compile(
        "(?<![a-z0-9])(?<!(?:anh|em|ong|ba|ban|thay|chu|me|bo|ten|nguoi|nhan|be|cau|bac|si"
            + "|con|cu|chau|thang|dua|nhoc|trai|gai|noi|ngoai|cha"
            + "|nho|than|benh|yeu|di|mo|dau|re|xa|vo|chong|chang|nang|nien"
            + "|co|chi|gia|la|hoc|sinh|vien|ta|su|nu|khach) )"
            + "(?:wifi|internet|ket\\s*noi|mang|tin\\s*hieu|bluetooth|camera|video|live|stream"
            + "|nuoc|gas|nguon|day|am\\s*thanh|dien)"
            + "\\s+(?:(?:vua|dang|hay|cu|lien\\s+tuc|thuong\\s+xuyen|bi)\\s+)*bi\\s+"
            + "ngat\\b(?=\\s*(?:$|(?:roi|lai|xong|lam|la|vay|thoi|thui|a|ha|nhe|nhi|ma|rui|ua|ho|ko|khong|dc|duoc|nua)\\b))",
        Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE
    );

    private ChatMedicalSafety() {
    }

    public static void rejectDiagnoseOrPrescribe(String answer) {
        if (containsUnsafeClaim(answer)) {
            throw new BusinessException(
                422,
                ErrorCodes.CHAT_CONTENT_BLOCKED,
                "AI response contained a diagnosis or prescription claim"
            );
        }
    }

    /** Shared non-throwing predicate for stateless/public response boundaries. */
    public static boolean containsUnsafeClaim(String answer) {
        if (answer == null) return false;
        // Sentences split on the RAW text so boundaries survive: normalizeInput
        // collapses punctuation, and a negation must never reach across one.
        // A refusal must grammatically modify this claim. An earlier "không
        // cần lo lắng" is not permission to accept a later dosage or diagnosis.
        for (String rawSentence : answer.split("[.!?\n;]")) {
            String normalized = normalizeInput(rawSentence);
            if (normalized == null) continue;
            java.util.regex.Matcher matcher = UNSAFE_CLAIM.matcher(normalized);
            while (matcher.find()) {
                String prefix = normalized.substring(0, matcher.start());
                java.util.regex.Matcher negation = NEGATION_FRAME.matcher(prefix);
                int lastNegationEnd = -1;
                while (negation.find()) lastNegationEnd = negation.end();
                if (lastNegationEnd < 0) return true;
                String gap = prefix.substring(lastNegationEnd);
                boolean asserted = ASSERTED_CLAIM.matcher(matcher.group()).find();
                Pattern scope = asserted
                    ? DIRECT_REFUSAL_GAP : REFUSAL_LIST_GAP;
                if (!scope.matcher(gap).matches()
                        && (asserted || !REFUSAL_ENUMERATION.matcher(normalized.substring(lastNegationEnd)).matches())) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Prevent a catalog-only fast path from bypassing the AI input safety
     * boundary when a user mixes a branch lookup with a clinical concern.
     */
    public static boolean containsProtectedInputCue(String input) {
        String normalized = normalizeInput(input);
        return normalized != null
            && (PROTECTED_INPUT_CUE.matcher(normalized).find()
                || ngatCrisisHit(normalized));
    }

    /**
     * Identify acute terms locally so an unavailable AI classifier cannot
     * downgrade an emergency and return a catalog navigation action.
     */
    public static boolean containsEmergencyInputCue(String input) {
        // Bound the scan on this unauthenticated boundary: normalization is
        // linear but copies the whole message, and a crisis cue opens the
        // message — anything buried past the window still reaches the
        // length/content validation that runs right after this check.
        String window = input != null && input.length() > EMERGENCY_SCAN_LIMIT
            ? input.substring(0, EMERGENCY_SCAN_LIMIT)
            : input;
        String normalized = normalizeInput(window);
        if (normalized == null) return false;
        if (EMERGENCY_INPUT_CUE.matcher(normalized).find()) return true;
        if (ngatCrisisHit(normalized)) return true;
        // Squashed-stream pass: the same substring semantics the ai-service
        // applies to the whole message — catches joined/prefixed typings the
        // token-start lookbehind cannot see (Wukong wave-12 F2/F3).
        String squashed = normalized.replace(" ", "");
        return squashedTier1Hit(squashed) || squashedSelfHarmHit(squashed);
    }

    /**
     * Return whether an unsuppressed "ngat" crisis candidate fires.
     *
     * Forward-benign continuations are already excluded inside NGAT_CRISIS;
     * this layer additionally drops candidates whose interrupt-sense
     * antecedent precedes them ("wifi bị ngắt"). Suppression stays
     * occurrence-local so a second, genuine "ngất"/"ngắt hơi" clause in the
     * same message still fires.
     */
    private static boolean ngatCrisisHit(String normalized) {
        Set<Integer> suppressedEnds = new HashSet<>();
        java.util.regex.Matcher reversed = NGAT_BENIGN_REVERSED.matcher(normalized);
        while (reversed.find()) suppressedEnds.add(reversed.end());
        java.util.regex.Matcher crisis = NGAT_CRISIS.matcher(normalized);
        while (crisis.find()) {
            if (!suppressedEnds.contains(crisis.end())) return true;
        }
        return false;
    }

    private static boolean squashedTier1Hit(String squashed) {
        if (EMERGENCY_SQUASHED_TIER1.matcher(squashed).find()) return true;
        // "cogiat" suppresses only when the remainder is a full laundry/
        // particle chain; an empty or non-chain rest fires (fail-safe).
        java.util.regex.Matcher cogiat = SQUASHED_COGIAT.matcher(squashed);
        while (cogiat.find()) {
            String rest = squashed.substring(cogiat.end());
            if (!rest.isEmpty()
                    && CO_GIAT_SQUASHED_SUPPRESS.matcher(rest).matches()) {
                continue;
            }
            return true;
        }
        return false;
    }

    private static boolean squashedSelfHarmHit(String squashed) {
        if (EMERGENCY_SQUASHED_SELF_HARM.matcher(squashed).find()) return true;
        // Bare "tutu" is only trusted at stream start — mid-stream it is
        // ambiguous with benign "từ từ" ("ditutu" = "đi từ từ"); volition
        // compounds in EMERGENCY_SQUASHED_SELF_HARM cover the marked cases
        // (mirrors ai-service _squashed_self_harm_hit).
        return squashed.startsWith("tutu")
            && (squashed.length() < 5
                || TUTU_BENIGN_CONTINUATIONS.indexOf(squashed.charAt(4)) < 0)
            && !squashed.startsWith("th", 4);
    }

    private static String normalizeInput(String input) {
        if (input == null || input.isBlank()) return null;
        String decomposed = Normalizer.normalize(input, Normalizer.Form.NFD)
            .toLowerCase(Locale.ROOT);
        // "từ" (grave accent — the benign adverb "từ từ"/preposition) and
        // "tự" (nặng accent — self-harm "tự tử") fold to the same "tu".
        // Mask the grave form before marks are stripped so the volition-guard
        // suicide cue cannot fire on "sẽ từ từ" while "sẽ tự tử" still does
        // (Wukong FP-A). Unaccented "tu tu" stays ambiguous → keeps firing.
        decomposed = decomposed.replace("tu\u031B\u0300", "tuu");
        return decomposed
            .replaceAll("\\p{M}+", "")
            .replace('đ', 'd')
            .replace('Đ', 'D')
            .replace('ð', 'd')
            .replaceAll("[^a-z0-9]+", " ")
            .trim()
            .replaceAll("\\s+", " ");
    }
}
