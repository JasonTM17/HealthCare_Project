"""LLM-backed triage with a deterministic, safety-first fallback."""

from __future__ import annotations

import json
from typing import Any

from app.schemas import TriageResponse

RULE_BASED = "rule_based_triage"
ALLOWED_URGENCY = frozenset({"EMERGENCY", "HIGH", "NORMAL"})
ALLOWED_SPECIALTIES = frozenset({
    "Tim Mạch & Can Thiệp Mạch Máu",
    "Thần Kinh & Đột Quỵ",
    "Tiêu Hóa - Gan Mật - Tụy",
    "Cơ Xương Khớp & Phục Hồi Chức Năng",
    "Sản Phụ Khoa",
    "Nhi Khoa",
    "Da Liễu",
    "Nội Tổng Quát",
    "Gói Khám Sức Khỏe Tổng Quát Toàn Diện",
})

_RULES = [
    (
        ["ngực", "tim", "hồi hộp", "khó thở", "đánh trống ngực"],
        "Tim Mạch & Can Thiệp Mạch Máu",
        "HIGH",
        "Nghi ngờ liên quan đến tim mạch hoặc tuần hoàn. Cần đo điện tâm đồ (ECG) và siêu âm tim sớm. Nếu đau tức ngực dữ dội kéo dài quá 15 phút, vui lòng gọi cấp cứu 1900 1234 ngay.",
        ["Cơn đau có lan lên hàm hoặc cánh tay trái không?", "Có tiền sử cao huyết áp hay đái tháo đường không?"],
    ),
    (
        ["bụng", "dạ dày", "tiêu hóa", "buồn nôn", "ợ chua", "đầy bụng", "đại tràng"],
        "Tiêu Hóa - Gan Mật - Tụy",
        "NORMAL",
        "Triệu chứng cảnh báo bệnh lý đường tiêu hóa. Khuyến nghị thăm khám chuyên khoa Tiêu hóa. Nếu cần nội soi, nên nhịn ăn ít nhất 6 tiếng trước giờ khám.",
        ["Đau xuất hiện lúc đói hay sau khi ăn no?", "Có sụt cân bất thường trong thời gian gần đây không?"],
    ),
    (
        ["đầu", "chóng mặt", "mất ngủ", "tê", "đột quỵ", "yếu tay", "liệt"],
        "Thần Kinh & Đột Quỵ",
        "NORMAL",
        "Dấu hiệu hệ thần kinh. Nếu có dấu hiệu FAST (méo miệng, yếu liệt tay chân, rối loạn giọng nói), cần chuyển ngay đến khoa Cấp cứu trong giờ vàng.",
        ["Có kèm theo buồn nôn hoặc sợ ánh sáng không?", "Cơn đau đầu xuất hiện đột ngột hay âm ỉ kéo dài?"],
    ),
    (
        ["khớp", "gối", "lưng", "cột sống", "xương", "cổ tay", "vai"],
        "Cơ Xương Khớp & Phục Hồi Chức Năng",
        "NORMAL",
        "Nên chụp X-quang hoặc siêu âm khớp chuyên sâu để đánh giá thoái hóa hoặc tổn thương mô mềm.",
        ["Có hiện tượng cứng khớp vào buổi sáng không?", "Khớp có sưng đỏ, nóng hoặc hạn chế vận động không?"],
    ),
]

_DEFAULT = TriageResponse(
    recommended_specialty="Gói Khám Sức Khỏe Tổng Quát Toàn Diện",
    urgency_level="NORMAL",
    clinical_advice="Triệu chứng chưa đặc hiệu cho một cơ quan đơn lẻ. Bác sĩ chuyên khoa Nội tổng quát sẽ thăm khám lâm sàng toàn diện và chỉ định các xét nghiệm cần thiết.",
    suggested_questions=[
        "Triệu chứng này đã kéo dài bao nhiêu ngày?",
        "Lần khám sức khỏe tổng quát gần nhất của bạn là khi nào?",
    ],
)


def rule_based_triage(symptoms: str) -> TriageResponse:
    symptom_text = symptoms.lower()
    for keywords, specialty, urgency, advice, questions in _RULES:
        if any(keyword in symptom_text for keyword in keywords):
            if specialty == "Tim Mạch & Can Thiệp Mạch Máu" and any(
                keyword in symptom_text for keyword in ["dữ dội", "ngất", "vã mồ hôi", "lan ra tay", "nhói buốt"]
            ):
                urgency = "EMERGENCY"
            if specialty == "Thần Kinh & Đột Quỵ" and any(
                keyword in symptom_text for keyword in ["méo miệng", "nói ngọng", "yếu một bên", "mờ mắt đột ngột"]
            ):
                urgency = "EMERGENCY"
            return TriageResponse(
                recommended_specialty=specialty,
                urgency_level=urgency,
                clinical_advice=advice,
                suggested_questions=questions,
            )
    return _DEFAULT.model_copy(deep=True)


def _validated_llm_response(data: Any, fallback: TriageResponse) -> TriageResponse:
    if not isinstance(data, dict):
        return fallback

    specialty = data.get("recommended_specialty")
    urgency = data.get("urgency_level")
    advice = data.get("clinical_advice")
    raw_questions = data.get("suggested_questions")
    if specialty not in ALLOWED_SPECIALTIES or urgency not in ALLOWED_URGENCY:
        return fallback
    if not isinstance(advice, str) or not advice.strip():
        return fallback

    questions: list[str] = []
    if isinstance(raw_questions, list):
        questions = [question.strip() for question in raw_questions if isinstance(question, str) and question.strip()][:3]
    if not questions:
        questions = fallback.suggested_questions

    return TriageResponse(
        recommended_specialty=specialty,
        urgency_level=urgency,
        clinical_advice=advice.strip()[:2000],
        suggested_questions=questions,
    )


def deepseek_triage(symptoms: str, settings: Any) -> TriageResponse:
    """Ask DeepSeek for bounded triage output; fall back on any provider error."""
    fallback = rule_based_triage(symptoms)
    try:
        from openai import OpenAI

        client = OpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
            timeout=10.0,
            max_retries=0,
        )
        completion = client.chat.completions.create(
            model=settings.deepseek_model,
            response_format={"type": "json_object"},
            temperature=0,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Bạn là trợ lý phân loại triệu chứng, không phải bác sĩ. Không chẩn đoán, "
                        "không kê đơn. Chỉ chọn một specialty trong danh sách: "
                        "Tim Mạch & Can Thiệp Mạch Máu; Thần Kinh & Đột Quỵ; Tiêu Hóa - Gan Mật - Tụy; "
                        "Cơ Xương Khớp & Phục Hồi Chức Năng; Sản Phụ Khoa; Nhi Khoa; Da Liễu; "
                        "Nội Tổng Quát; Gói Khám Sức Khỏe Tổng Quát Toàn Diện. "
                        "urgency_level chỉ được là EMERGENCY, HIGH hoặc NORMAL. Trả JSON với các khóa "
                        "recommended_specialty, urgency_level, clinical_advice, suggested_questions; "
                        "suggested_questions tối đa 3 câu hỏi."
                    ),
                },
                {"role": "user", "content": symptoms},
            ],
        )
        content = completion.choices[0].message.content or "{}"
        return _validated_llm_response(json.loads(content), fallback)
    except Exception:
        return fallback


def resolve_triage(symptoms: str, settings: Any) -> TriageResponse:
    if settings.ai_provider == "deepseek" and settings.deepseek_api_key:
        return deepseek_triage(symptoms, settings)
    return rule_based_triage(symptoms)
