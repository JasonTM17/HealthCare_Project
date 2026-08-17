"""Tests for the LLM triage provider and its rule-based fallback."""

from unittest.mock import MagicMock, patch

from app.llm import rule_based_triage, resolve_triage, RULE_BASED
from app.schemas import TriageResponse


def test_rule_based_cardiology_emergency():
    result = rule_based_triage("đau thắt ngực dữ dội vã mồ hôi")
    assert result.recommended_specialty == "Tim Mạch & Can Thiệp Mạch Máu"
    assert result.urgency_level == "EMERGENCY"


def test_rule_based_stroke_emergency():
    result = rule_based_triage("tôi bị đột quỵ méo miệng nói ngọng")
    assert result.recommended_specialty == "Thần Kinh & Đột Quỵ"
    assert result.urgency_level == "EMERGENCY"


def test_rule_based_neurology_normal():
    result = rule_based_triage("đau đầu âm ỉ mất ngủ")
    assert result.recommended_specialty == "Thần Kinh & Đột Quỵ"
    assert result.urgency_level == "NORMAL"


def test_rule_based_default():
    result = rule_based_triage("cảm thấy mệt mỏi nhẹ")
    assert result.recommended_specialty == "Gói Khám Sức Khỏe Tổng Quát Toàn Diện"


def test_resolve_uses_rules_when_no_deepseek():
    settings = MagicMock()
    settings.ai_provider = RULE_BASED
    settings.deepseek_api_key = ""
    result = resolve_triage("đau ngực dữ dội", settings)
    assert result.recommended_specialty == "Tim Mạch & Can Thiệp Mạch Máu"


def test_resolve_deepseek_success():
    settings = MagicMock()
    settings.ai_provider = "deepseek"
    settings.deepseek_api_key = "test-key"
    settings.deepseek_model = "deepseek-chat"
    settings.deepseek_base_url = "https://api.deepseek.com"

    mock_message = MagicMock()
    mock_message.content = '{"recommended_specialty":"Thần Kinh","urgency_level":"HIGH","clinical_advice":"advice","suggested_questions":["q1"]}'
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_completion = MagicMock()
    mock_completion.choices = [mock_choice]

    with patch("openai.OpenAI") as mock_openai:
        mock_openai.return_value.chat.completions.create.return_value = mock_completion
        result = resolve_triage("chóng mặt đau đầu", settings)

    assert result.recommended_specialty == "Thần Kinh"
    assert result.urgency_level == "HIGH"


def test_resolve_deepseek_falls_back_on_error():
    settings = MagicMock()
    settings.ai_provider = "deepseek"
    settings.deepseek_api_key = "test-key"
    settings.deepseek_model = "deepseek-chat"
    settings.deepseek_base_url = "https://api.deepseek.com"

    with patch("openai.OpenAI", side_effect=Exception("provider down")):
        result = resolve_triage("đau ngực dữ dội", settings)

    # Falls back to rule-based, which detects cardiac emergency
    assert result.recommended_specialty == "Tim Mạch & Can Thiệp Mạch Máu"
    assert result.urgency_level == "EMERGENCY"
