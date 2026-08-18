"""Tests for the LLM provider policy and structured fallback."""

import pytest
from unittest.mock import MagicMock, patch

from app.llm import build_llm_client, rule_based_triage, resolve_triage, RULE_BASED
from app.providers import ProviderUnavailable


def test_rule_based_cardiology_emergency() -> None:
    result = rule_based_triage("đau thắt ngực dữ dội vã mồ hôi")
    assert result.recommended_specialty == "Tim Mạch & Can Thiệp Mạch Máu"
    assert result.urgency_level == "EMERGENCY"


def test_rule_based_stroke_emergency() -> None:
    result = rule_based_triage("tôi bị đột quỵ méo miệng nói ngọng")
    assert result.recommended_specialty == "Thần Kinh & Đột Quỵ"
    assert result.urgency_level == "EMERGENCY"


def test_rule_based_neurology_normal() -> None:
    result = rule_based_triage("đau đầu âm ỉ mất ngủ")
    assert result.recommended_specialty == "Thần Kinh & Đột Quỵ"
    assert result.urgency_level == "NORMAL"


def test_rule_based_default() -> None:
    result = rule_based_triage("cảm thấy mệt mỏi nhẹ")
    assert result.recommended_specialty == "Gói Khám Sức Khỏe Tổng Quát Toàn Diện"


def test_resolve_uses_rules_when_no_deepseek() -> None:
    settings = MagicMock()
    settings.ai_provider = RULE_BASED
    settings.deepseek_api_key = ""
    result = resolve_triage("đau ngực dữ dội", settings)
    assert result.recommended_specialty == "Tim Mạch & Can Thiệp Mạch Máu"


def test_resolve_deepseek_success() -> None:
    settings = MagicMock()
    settings.ai_provider = "deepseek"
    settings.deepseek_api_key = "test-key"
    settings.deepseek_model = "deepseek-chat"
    settings.deepseek_base_url = "https://api.deepseek.com"

    mock_message = MagicMock()
    mock_message.content = '{"recommended_specialty":"Thần Kinh & Đột Quỵ","urgency_level":"HIGH","clinical_advice":"advice","suggested_questions":["q1"]}'
    mock_choice = MagicMock()
    mock_choice.message = mock_message
    mock_completion = MagicMock()
    mock_completion.choices = [mock_choice]

    with patch("openai.OpenAI") as mock_openai:
        mock_openai.return_value.chat.completions.create.return_value = mock_completion
        result = resolve_triage("chóng mặt đau đầu", settings)

    assert result.recommended_specialty == "Thần Kinh & Đột Quỵ"
    assert result.urgency_level == "HIGH"
    assert result.provenance == "remote_provider"


def test_remote_provider_uses_configured_timeout() -> None:
    settings = MagicMock()
    settings.ai_provider = "deepseek"
    settings.ai_api_key = "test-key"
    settings.ai_chat_model = "deepseek-chat"
    settings.ai_base_url = "https://api.deepseek.com"
    settings.ai_timeout_seconds = 4.25

    mock_message = MagicMock()
    mock_message.content = (
        '{"recommended_specialty":"Thần Kinh & Đột Quỵ",'
        '"urgency_level":"HIGH","clinical_advice":"advice",'
        '"suggested_questions":["q1"]}'
    )
    mock_completion = MagicMock()
    mock_completion.choices = [MagicMock(message=mock_message)]

    with patch("openai.OpenAI") as mock_openai:
        mock_openai.return_value.chat.completions.create.return_value = mock_completion
        result = resolve_triage("chóng mặt", settings)

    assert result.recommended_specialty == "Thần Kinh & Đột Quỵ"
    mock_openai.assert_called_once_with(
        api_key="test-key",
        base_url="https://api.deepseek.com",
        timeout=4.25,
        max_retries=0,
    )


def test_openai_provider_does_not_use_deepseek_alias_credentials_or_defaults() -> None:
    settings = MagicMock()
    settings.ai_provider = "openai"
    settings.ai_api_key = ""
    settings.deepseek_api_key = "legacy-key"
    settings.ai_chat_model = ""
    settings.deepseek_model = "deepseek-chat"
    settings.ai_base_url = ""
    settings.deepseek_base_url = "https://api.deepseek.com"

    assert build_llm_client(settings) is None


def test_remote_output_with_unknown_fields_falls_back() -> None:
    fallback = rule_based_triage("đau ngực dữ dội")
    settings = MagicMock()
    settings.ai_provider = "deepseek"
    settings.deepseek_api_key = "test-key"
    settings.deepseek_model = "deepseek-chat"
    settings.deepseek_base_url = "https://api.deepseek.com"
    settings.ai_service_runtime = "local"

    mock_message = MagicMock()
    mock_message.content = (
        '{"recommended_specialty":"Thần Kinh & Đột Quỵ",'
        '"urgency_level":"HIGH","clinical_advice":"advice",'
        '"suggested_questions":[],"doctor_id":"invented"}'
    )
    mock_completion = MagicMock()
    mock_completion.choices = [MagicMock(message=mock_message)]

    with patch("openai.OpenAI") as mock_openai:
        mock_openai.return_value.chat.completions.create.return_value = mock_completion
        result = resolve_triage("đau ngực dữ dội", settings)

    assert result.model_dump(exclude={"provenance"}) == fallback.model_dump(
        exclude={"provenance"}
    )
    assert result.provenance == "local_fallback"


def test_resolve_deepseek_falls_back_on_error() -> None:
    settings = MagicMock()
    settings.ai_provider = "deepseek"
    settings.deepseek_api_key = "test-key"
    settings.deepseek_model = "deepseek-chat"
    settings.deepseek_base_url = "https://api.deepseek.com"
    settings.ai_service_runtime = "local"

    with patch("openai.OpenAI", side_effect=Exception("provider down")):
        result = resolve_triage("đau ngực dữ dội", settings)

    # Falls back to rule-based, which detects cardiac emergency
    assert result.recommended_specialty == "Tim Mạch & Can Thiệp Mạch Máu"
    assert result.urgency_level == "EMERGENCY"
    assert result.provenance == "local_fallback"


def test_remote_provider_failure_fails_closed_outside_local_runtime() -> None:
    settings = MagicMock()
    settings.ai_provider = "deepseek"
    settings.deepseek_api_key = "test-key"
    settings.deepseek_model = "deepseek-chat"
    settings.deepseek_base_url = "https://api.deepseek.com"
    settings.ai_service_runtime = "staging"

    with patch("openai.OpenAI", side_effect=Exception("provider down")):
        with pytest.raises(ProviderUnavailable):
            resolve_triage("đau ngực dữ dội", settings)


def test_invalid_remote_output_fails_closed_outside_local_runtime() -> None:
    settings = MagicMock()
    settings.ai_provider = "deepseek"
    settings.deepseek_api_key = "test-key"
    settings.deepseek_model = "deepseek-chat"
    settings.deepseek_base_url = "https://api.deepseek.com"
    settings.ai_service_runtime = "staging"

    mock_message = MagicMock()
    mock_message.content = '{"doctor_id":"invented"}'
    mock_completion = MagicMock()
    mock_completion.choices = [MagicMock(message=mock_message)]

    with patch("openai.OpenAI") as mock_openai:
        mock_openai.return_value.chat.completions.create.return_value = mock_completion
        with pytest.raises(ProviderUnavailable):
            resolve_triage("đau ngực", settings)
