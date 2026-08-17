"""LLM-backed triage with a rule-based fallback.

When ``ai_provider`` is ``"deepseek"`` and a key is configured, triage is
answered by the DeepSeek chat model (OpenAI-compatible API). Otherwise the
deterministic rule-based baseline is used. The LLM path is best-effort: any
provider failure falls back to the rule baseline so the endpoint stays
available offline.
"""

from __future__ import annotations

from app.schemas import TriageResponse

RULE_BASED = "rule_based_triage"

# Deterministic baseline — also serves as the offline/fallback triage.
_RULES = [
    (["ngực", "tim", "hồi hộp", "khó thở", "đánh trống ngực"],
     "Tim Mạch & Can Thiệp Mạch Máu", "HIGH",
     "Nghi ngờ liên quan đến tim mạch hoặc tuần hoàn. Cần đo điện tâm đồ (ECG) và siêu âm tim sớm. Nếu đau tức ngực dữ dội kéo dài quá 15 phút, vui lòng gọi cấp cứu 1900 1234 ngay.",
     ["Cơn đau có lan lên hàm hoặc cánh tay trái không?", "Có tiền sử cao huyết áp hay đái tháo đường không?"]),
    (["bụng", "dạ dày", "tiêu hóa", "buồn nôn", "ợchua", "đầy bụng", "đại tràng"],
     "Tiêu Hóa - Gan Mật - Tụy", "NORMAL",
     "Triệu chứng cảnh báo bệnh lý đường tiêu hóa. Khuyến nghị thăm khám chuyên khoa Tiêu hóa. Nếu cần nội soi, nên nhịn ăn ít nhất 6 tiếng trước giờ khám.",
     ["Đau xuất hiện lúc đói hay sau khi ăn no?", "Có sụt cân bất thường trong thời gian gần đây không?"]),
    (["đầu", "chóng mặt", "mất ngủ", "tê", "đột quỵ", "yếu tay", "liệt"],
     "Thần Kinh & Đột Quỵ", "NORMAL",
     "Dấu hiệu hệ thần kinh. Nếu có dấu hiệu FAST (Méo miệng, Yếu liệt tay chân, Rối loạn giọng nói), cần chuyển ngay đến khoa Cấp cứu trong giờ vàng.",
     ["Có kèm theo buồn nôn hoặc sợ ánh sáng không?", "Cơn đau đầu xuất hiện đột ngột hay âm ỉ kéo dài?"]),
    (["khớp", "gối", "lưng", "cột sống", "xương", "cổ tay", "vai"],
     "Cơ Xương Khớp & Phục Hồi Chức Năng", "NORMAL",
     "Nên chụp X-quang hoặc siêu âm khớp chuyên sâu để đánh giá thoái hóa hoặc tổn thương mô mềm.",
     ["Có hiện tượng cứng khớp vào buổi sáng không?", "Khớp có sưng đỏ, nóng hoặc hạn chế vận động không?"]),
]

_DEFAULT = {
    "recommended_specialty": "Gói Khám Sức Khỏe Tổng Quát Toàn Diện",
    "urgency_level": "NORMAL",
    "clinical_advice": "Triệu chứng chưa đặc hiệu cho một cơ quan đơn lẻ. Bác sĩ chuyên khoa Nội tổng quát sẽ thăm khám lâm sàng toàn diện và chỉ định các xét nghiệm cần thiết.",
    "suggested_questions": [
        "Triệu chứng này đã kéo dài bao nhiêu ngày?",
        "Lần khám sức khỏe tổng quát gần nhất của bạn là khi nào?",
    ],
}


def rule_based_triage(symptoms: str) -> TriageResponse:
    s = symptoms.lower()
    for keywords, specialty, urgency, advice, questions in _RULES:
        if any(k in s for k in keywords):
            if specialty == "Tim Mạch & Can Thiệp Mạch Máu" and any(
                k in s for k in ["dữ dội", "ngất", "vã mồ hôi", "lan ra tay", "nhói buốt"]
            ):
                return TriageResponse(recommended_specialty=specialty, urgency_level="EMERGENCY",
                                      clinical_advice=advice, suggested_questions=questions)
            if specialty == "Thần Kinh & Đột Quỵ" and any(
                k in s for k in ["méo miệng", "nói ngọng", "yếu một bên", "mờ mặt đột ngột"]
            ):
                return TriageResponse(recommended_specialty=specialty, urgency_level="EMERGENCY",
                                      clinical_advice=advice, suggested_questions=questions)
            return TriageResponse(recommended_specialty=specialty, urgency_level=urgency,
                                  clinical_advice=advice, suggested_questions=questions)
    return TriageResponse(**_DEFAULT)


def deepseek_triage(symptoms: str, settings) -> TriageResponse:
    """Ask DeepSeek for a triage opinion. Falls back to rules on any error."""
    try:
        from openai import OpenAI

        client = OpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
        )
        completion = client.chat.completions.create(
            model=settings.deepseek_model,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content":
                        "Bác sĩ tư vấn y khoa an toàn. Dựa trên triệu chứng, đề xuất "
                        "MỘT chuyên khoa phù hợp nhất (Ti Mạch, Thần kinh, Tiêu hóa, "
                        "Cơ Xương Khớp, Sản phụ khoa, Nhi khoa, Da liễu, Nội tổng hợp), "
                        "mức khẩn (EMERGENCY/HIGH/NORMAL), lời khuyên ngắn (không chẩn đoán, "
                        "không kê đơn) và 2 câu hỏi lái. Trả JSON với các khóa: "
                        "recommended_specialty, urgency_level, clinical_advice, suggested_questions.",
                },
                {"role": "user", "content": symptoms},
            ],
        )
        import json

        content = completion.choices[0].message.content or "{}"
        data = json.loads(content)
        default = _DEFAULT
        return TriageResponse(
            recommended_specialty=data.get("recommended_specialty", default["recommended_specialty"]),
            urgency_level=data.get("urgency_level", "NORMAL"),
            clinical_advice=data.get("clinical_advice", default["clinical_advice"]),
            suggested_questions=data.get("suggested_questions", default["suggested_questions"]),
        )
    except Exception:
        return rule_based_triage(symptoms)


def resolve_triage(symptoms: str, settings) -> TriageResponse:
    if settings.ai_provider == "deepseek" and settings.deepseek_api_key:
        return deepseek_triage(symptoms, settings)
    return rule_based_triage(symptoms)
