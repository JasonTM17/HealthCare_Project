"""Integration tests for DeepSeek v4 Flash remote calls and RAG chatbot."""

from unittest.mock import MagicMock

from app.chatbot import (
    ChatMode,
    ChatRetrieveRequest,
    retrieve_chat_candidates,
)
from app.llm import (
    patient_chat_remote_enabled,
    resolve_chat,
    rule_based_triage,
)
from app.rag import RagService
from app.schemas import Citation


def _deepseek_settings(*, release_hold: bool = True, synthetic_only: bool = False) -> MagicMock:
    """Create settings simulating DeepSeek v4 Flash configuration."""
    cfg = MagicMock()
    cfg.ai_provider = "deepseek"
    cfg.ai_chat_model = "deepseek-v4-flash"
    cfg.ai_base_url = "https://api.deepseek.com"
    cfg.deepseek_api_key = "sk-test-deepseek-key-123456"
    cfg.ai_api_key = "sk-test-deepseek-key-123456"
    cfg.ai_service_runtime = "synthetic-beta"
    cfg.ai_patient_chat_remote_enabled = True
    cfg.ai_chat_remote_provider_enabled = True
    cfg.remote_ai_release_hold = release_hold
    cfg.remote_ai_synthetic_only = synthetic_only
    cfg.remote_ai_provider_allowlist = "deepseek"
    cfg.remote_ai_https_host_allowlist = "api.deepseek.com"
    cfg.rag_storage_backend = "supabase"
    cfg.supabase_rag_fallback_to_memory = False
    cfg.ai_chat_relevance_threshold = 0.35
    cfg.ai_max_retrieved_chunks = 5
    return cfg


def test_patient_chat_remote_enabled_requires_release_hold() -> None:
    settings_on = _deepseek_settings(release_hold=True)
    assert patient_chat_remote_enabled(settings_on) is True

    settings_hold = _deepseek_settings(release_hold=False)
    assert patient_chat_remote_enabled(settings_hold) is False


def test_deepseek_v4_flash_executes_when_release_hold_is_active() -> None:
    settings = _deepseek_settings(release_hold=True, synthetic_only=False)
    mock_client = MagicMock()
    mock_client.complete_json.return_value = {
        "answer": "Theo thông tin tham khảo từ chuyên khoa Tim Mạch, việc theo dõi huyết áp định kỳ rất quan trọng. Bạn nên trao đổi trực tiếp với bác sĩ chuyên khoa tim mạch."
    }

    response = resolve_chat(
        "Tôi muốn được tư vấn theo dõi huyết áp định kỳ tại chuyên khoa Tim Mạch",
        settings,
        context=["Chuyên khoa Tim Mạch: Khám, tư vấn và điều trị các bệnh lý tim mạch, theo dõi huyết áp định kỳ."],
        citations=[Citation(source_type="specialty", source_id="cardiology", title="Tim Mạch")],
        client=mock_client,
        synthetic_beta=False,
    )

    assert response.provenance == "remote_provider"
    assert "Tim Mạch" in response.answer
    assert len(response.citations) == 1
    assert response.citations[0].title == "Tim Mạch"
    mock_client.complete_json.assert_called_once()


def test_deepseek_triage_difficult_symptoms_with_expanded_rules() -> None:
    # Difficult symptom query: gastroesophageal reflux
    triage_reflux = rule_based_triage("Tôi hay bị trào ngược dạ dày, ợ chua và rát cổ họng")
    assert triage_reflux.recommended_specialty == "Tiêu Hóa - Gan Mật - Tụy"

    # Difficult symptom query: pediatric convulsion
    triage_pedia = rule_based_triage("Bé nhà tôi 2 tuổi bị sốt co giật và nôn trớ")
    assert triage_pedia.recommended_specialty == "Nhi Khoa"

    # Difficult symptom query: respiratory / asthma
    triage_resp = rule_based_triage("Tôi bị hen phế quản, thở khò khè nhiều về đêm")
    assert triage_resp.recommended_specialty == "Hô Hấp & Phổi"

    # Difficult symptom query: dermatology
    triage_derma = rule_based_triage("Da tôi bị mẩn đỏ ngứa, nghi do viêm da dị ứng")
    assert triage_derma.recommended_specialty == "Da Liễu & Thẩm Mỹ Da"

    # Difficult symptom query: gynecology
    triage_gyn = rule_based_triage("Tôi bị rối loạn kinh nguyệt và chậm kinh nghi do thai kỳ")
    assert triage_gyn.recommended_specialty == "Sản Phụ Khoa"

    # Difficult symptom query: ophthalmology
    triage_eye = rule_based_triage("Mắt tôi dạo này nhìn mờ và nhức mỏi nhiều khi làm việc")
    assert triage_eye.recommended_specialty == "Mắt & Nhãn Khoa"

    # Difficult symptom query: endocrinology
    triage_endo = rule_based_triage("Tôi bị đường huyết tăng cao kèm sụt cân nhanh")
    assert triage_endo.recommended_specialty == "Nội Tiết & Chuyển Hóa"


def test_expanded_symptom_lexical_rescue_matches_specialties() -> None:
    service = RagService()
    vector = [0.0, 1.0] + [0.0] * 382

    service.ingest(
        "specialty",
        "ho-hap",
        "Hô hấp",
        "Khám và điều trị hen phế quản, viêm phổi, copd.",
        vector,
        embedding_model="local-hash",
    )
    service.ingest(
        "specialty",
        "da-lieu",
        "Da liễu",
        "Khám và điều trị viêm da cơ địa, dị ứng da, mẩn ngứa.",
        vector,
        embedding_model="local-hash",
    )

    resp_resp = retrieve_chat_candidates(
        ChatRetrieveRequest(
            message="Tôi bị thở khò khè kéo dài cần khám khoa nào?",
            mode=ChatMode.HOSPITAL_SUPPORT,
        ),
        _deepseek_settings(),
        service,
        embedder=lambda *_: (vector, "local-hash"),
    )
    assert any(c.source_id == "ho-hap" for c in resp_resp.candidates)

    resp_derma = retrieve_chat_candidates(
        ChatRetrieveRequest(
            message="Tôi bị mẩn ngứa dị ứng da nổi mề đay",
            mode=ChatMode.HOSPITAL_SUPPORT,
        ),
        _deepseek_settings(),
        service,
        embedder=lambda *_: (vector, "local-hash"),
    )
    assert any(c.source_id == "da-lieu" for c in resp_derma.candidates)
