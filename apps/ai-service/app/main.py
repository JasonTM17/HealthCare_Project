from fastapi import FastAPI
from pydantic_settings import BaseSettings
from app.schemas import HealthResponse, TriageRequest, TriageResponse


class Settings(BaseSettings):
    service_name: str = "healthcare-ai-service"
    ai_provider: str = "rule_based_triage"
    # DeepSeek LLM credentials — consumed when ai_provider is switched to "deepseek"
    deepseek_api_key: str = ""
    deepseek_model: str = "deepseek-chat"
    deepseek_base_url: str = "https://api.deepseek.com"


settings = Settings()
app = FastAPI(title="HealthCare AI Service", version="0.1.0")


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service=settings.service_name,
        ai_provider=settings.ai_provider,
        deepseek_configured=bool(settings.deepseek_api_key),
        deepseek_model=settings.deepseek_model if settings.deepseek_api_key else None,
    )


@app.post("/triage", response_model=TriageResponse)
def symptom_triage(request: TriageRequest) -> TriageResponse:
    s = request.symptoms.lower()

    if any(k in s for k in ["ngực", "tim", "hồi hộp", "khó thở", "đánh trống ngực"]):
        is_severe = any(k in s for k in ["dữ dội", "ngất", "vã mồ hôi", "lan ra tay", "nhói buốt"])
        return TriageResponse(
            recommended_specialty="Tim Mạch & Can Thiệp Mạch Máu",
            urgency_level="EMERGENCY" if is_severe else "HIGH",
            clinical_advice="Nghi ngờ liên quan đến tim mạch hoặc tuần hoàn. Cần đo điện tâm đồ (ECG) và siêu âm tim sớm. Nếu đau tức ngực dữ dội kéo dài quá 15 phút, vui lòng gọi cấp cứu 1900 1234 ngay.",
            suggested_questions=[
                "Cơn đau có lan lên hàm hoặc cánh tay trái không?",
                "Có tiền sử cao huyết áp hay đái tháo đường không?",
            ],
        )

    if any(k in s for k in ["bụng", "dạ dày", "tiêu hóa", "buồn nôn", "ợ chua", "đầy bụng", "đại tràng"]):
        return TriageResponse(
            recommended_specialty="Tiêu Hóa - Gan Mật - Tụy",
            urgency_level="NORMAL",
            clinical_advice="Triệu chứng cảnh báo bệnh lý đường tiêu hóa. Khuyến nghị thăm khám chuyên khoa Tiêu hóa. Nếu cần nội soi, nên nhịn ăn ít nhất 6 tiếng trước giờ khám.",
            suggested_questions=[
                "Đau xuất hiện lúc đói hay sau khi ăn no?",
                "Có sụt cân bất thường trong thời gian gần đây không?",
            ],
        )

    if any(k in s for k in ["đầu", "chóng mặt", "mất ngủ", "tê", "đột quỵ", "yếu tay", "liệt"]):
        is_stroke_suspect = any(k in s for k in ["méo miệng", "nói ngọng", "yếu một bên", "mờ mắt đột ngột"])
        return TriageResponse(
            recommended_specialty="Thần Kinh & Đột Quỵ",
            urgency_level="EMERGENCY" if is_stroke_suspect else "NORMAL",
            clinical_advice="Dấu hiệu hệ thần kinh. Nếu có dấu hiệu FAST (Méo miệng, Yếu liệt tay chân, Rối loạn giọng nói), cần chuyển ngay đến khoa Cấp cứu trong giờ vàng.",
            suggested_questions=[
                "Có kèm theo buồn nôn hoặc sợ ánh sáng không?",
                "Cơn đau đầu xuất hiện đột ngột hay âm ỉ kéo dài?",
            ],
        )

    if any(k in s for k in ["khớp", "gối", "lưng", "cột sống", "xương", "cổ tay", "vai"]):
        return TriageResponse(
            recommended_specialty="Cơ Xương Khớp & Phục Hồi Chức Năng",
            urgency_level="NORMAL",
            clinical_advice="Nên chụp X-quang hoặc siêu âm khớp chuyên sâu để đánh giá thoái hóa hoặc tổn thương mô mềm.",
            suggested_questions=[
                "Có hiện tượng cứng khớp vào buổi sáng không?",
                "Khớp có sưng đỏ, nóng hoặc hạn chế vận động không?",
            ],
        )

    return TriageResponse(
        recommended_specialty="Gói Khám Sức Khỏe Tổng Quát Toàn Diện",
        urgency_level="NORMAL",
        clinical_advice="Triệu chứng chưa đặc hiệu cho một cơ quan đơn lẻ. Bác sĩ chuyên khoa Nội tổng quát sẽ thăm khám lâm sàng toàn diện và chỉ định các xét nghiệm cần thiết.",
        suggested_questions=[
            "Triệu chứng này đã kéo dài bao nhiêu ngày?",
            "Lần khám sức khỏe tổng quát gần nhất của bạn là khi nào?",
        ],
    )
