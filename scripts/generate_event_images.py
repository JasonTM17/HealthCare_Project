import os
from PIL import Image, ImageDraw, ImageFont, ImageEnhance, ImageFilter

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MEDIA_DIR = os.path.join(BASE_DIR, "apps", "frontend", "public", "media")
EVENTS_DIR = os.path.join(MEDIA_DIR, "events")
os.makedirs(EVENTS_DIR, exist_ok=True)

FONT_BOLD = "C:/Windows/Fonts/arialbd.ttf" if os.path.exists("C:/Windows/Fonts/arialbd.ttf") else "C:/Windows/Fonts/arial.ttf"
FONT_REGULAR = "C:/Windows/Fonts/arial.ttf"
FONT_SEGOE = "C:/Windows/Fonts/segoeuib.ttf" if os.path.exists("C:/Windows/Fonts/segoeuib.ttf") else FONT_BOLD

# Palette - Healthcare clinical tokens
TEAL_DARK = (15, 118, 110)      # #0f766e
TEAL_PRIMARY = (13, 148, 136)   # #0d9488
MINT_LIGHT = (204, 251, 241)    # #ccfbf1
WHITE = (255, 255, 255)
GOLD = (234, 179, 8)            # #eab308
NAVY_OVERLAY = (10, 30, 45)

EVENTS_SPECS = [
    # Batch 1: Previous 18 events
    {
        "filename": "toa-dam-tim-mach-can-thiep.jpg",
        "source": "articles/cardiology-clinic-consult.jpg",
        "category": "HỘI THẢO CHUYÊN MÔN",
        "title": "Tọa Đàm Khoa Học: Cập Nhật Tiến Bộ Tim Mạch Can Thiệp",
        "subtitle": "Quy tụ hơn 50 chuyên gia đầu ngành Tim mạch & Hồi sức cấp cứu",
        "tag": "CHUYÊN ĐỀ HỌC THUẬT"
    },
    {
        "filename": "tuan-le-phong-chong-dot-quy.jpg",
        "source": "articles/cv-brain-stroke.jpg",
        "category": "Y TẾ CỘNG ĐỒNG",
        "title": "Tuần Lễ Truyền Thông: Nhận Diện & Xử Trí Đột Quỵ Sớm FAST",
        "subtitle": "Tư vấn phòng ngừa đột quỵ não và sơ cứu chuẩn y khoa cho người dân",
        "tag": "CHIẾN DỊCH SỨC KHỎE"
    },
    {
        "filename": "kham-tam-soat-nguoi-cao-tuoi.jpg",
        "source": "articles/cham-soc-suc-khoe-tong-quat.jpg",
        "category": "CHĂM SÓC CỘNG ĐỒNG",
        "title": "Ngày Hội Sức Khỏe Vàng: Tầm Soát Miễn Phí Cho Người Cao Tuổi",
        "subtitle": "Đo huyết áp, đo loãng xương, xét nghiệm đường huyết và tư vấn lão khoa",
        "tag": "THIỆN NGUYỆN Y TẾ"
    },
    {
        "filename": "ngay-hoi-mat-sang-hoc-duong.jpg",
        "source": "articles/mat.jpg",
        "category": "Y TẾ HỌC ĐƯỜNG",
        "title": "Chương Trình 'Mắt Sáng Tương Lai': Khám Thị Lực Học Đường",
        "subtitle": "Tầm soát tật khúc xạ, đo thị lực và tặng kính thuốc cho học sinh",
        "tag": "VÌ NỤ CƯỜI TRẺ THƠ"
    },
    {
        "filename": "tu-van-dinh-duong-hoc-duong.jpg",
        "source": "articles/cham-soc-tre-em.jpg",
        "category": "DINH DƯỠNG NHI KHOA",
        "title": "Hội Thảo Dinh Dưỡng: Phát Triển Thể Chất & Chiều Cao Trẻ Em",
        "subtitle": "Bác sĩ chuyên khoa Nhi chia sẻ chế độ vi chất khoa học cho phụ huynh",
        "tag": "CẨM NANG GIA ĐÌNH"
    },
    {
        "filename": "chien-dich-tiem-chung-mua-dong-xuan.jpg",
        "source": "articles/cv-vaccine-arm.jpg",
        "category": "Y TẾ DỰ PHÒNG",
        "title": "Chiến Dịch Tiêm Chủng Mở Rộng: Bảo Vệ Cả Gia Đình Mùa Đông Xuân",
        "subtitle": "Ưu đãi vaccine cúm, phế cầu và viêm gan cho cộng đồng",
        "tag": "PHÒNG BỆNH CHỦ ĐỘNG"
    },
    {
        "filename": "khanh-thanh-trung-tam-ky-thuat-cao.jpg",
        "source": "branches/branch-hospital-modern-facade.jpg",
        "category": "SỰ KIỆN BỆNH VIỆN",
        "title": "Lễ Khánh Thành Tòa Nhà Khám Chữa Bệnh Kỹ Thuật Cao Mới",
        "subtitle": "Nâng cấp cơ sở vật chất 500 giường bệnh đạt tiêu chuẩn quốc tế",
        "tag": "BƯỚC NGOẶT PHÁT TRIỂN"
    },
    {
        "filename": "le-ky-ket-hop-tac-y-khoa-quoc-te.jpg",
        "source": "branches/branch-clinic-hall.jpg",
        "category": "HỢP TÁC QUỐC TẾ",
        "title": "Lễ Ký Kết Hợp Tác Y Khoa Chiến Lược & Chuyển Giao Công Nghệ",
        "subtitle": "Hợp tác đào tạo bác sĩ nội trú và chuyển giao kỹ thuật mổ nội soi tiên tiến",
        "tag": "HỘI NHẬP TOÀN CẦU"
    },
    {
        "filename": "don-nhan-chung-nhan-chat-luong-jci.jpg",
        "source": "branches/branch-reception.jpg",
        "category": "CHẤT LƯỢNG BỆNH VIỆN",
        "title": "Lễ Đón Nhận Chứng Chỉ Quản Lý Chất Lượng Y Tế Quốc Tế",
        "subtitle": "Khẳng định cam kết an toàn người bệnh và tiêu chuẩn lâm sàng toàn cầu",
        "tag": "CHUẨN MỰC QUỐC TẾ"
    },
    {
        "filename": "hoi-thi-dieu-duong-gioi-thanh-lich.jpg",
        "source": "articles/cv-doc-female-tele.jpg",
        "category": "HOẠT ĐỘNG NỘI BỘ",
        "title": "Hội Thi 'Điều Dưỡng Giỏi - Tận Tâm - Thanh Lịch' Toàn Viện",
        "subtitle": "Tôn vinh y đức, sự tận tụy và nghiệp vụ chăm sóc người bệnh chu đáo",
        "tag": "TRI ÂN BLOUSE TRẮNG"
    },
    {
        "filename": "ngay-hoi-di-bo-vi-trai-tim-khoe.jpg",
        "source": "articles/cv-cardio-running.jpg",
        "category": "PHONG TRÀO THỂ THAO",
        "title": "Ngày Hội Đi Bộ Đồng Hành: Vận Động Vì Một Trái Tim Khỏe Mạnh",
        "subtitle": "Hơn 1.000 cán bộ y tế và người dân cùng sải bước nâng cao sức khỏe",
        "tag": "NGÀY TIM MẠCH"
    },
    {
        "filename": "hoi-nghi-ngoai-khoa-quoc-te.jpg",
        "source": "articles/cv-surgery-team.jpg",
        "category": "NGOẠI KHOA CHUYÊN SÂU",
        "title": "Hội Nghị Ngoại Khoa Toàn Quốc: Đột Phá Phẫu Thuật Ít Xâm Lấn",
        "subtitle": "Trình diễn các ca phẫu thuật truyền hình trực tiếp từ phòng mổ Hybrid",
        "tag": "CÔNG NGHỆ CAO"
    },
    {
        "filename": "tam-soat-ung-thu-cong-dong.jpg",
        "source": "articles/ung-buou.jpg",
        "category": "TẦM SOÁT UNG THƯ",
        "title": "Chương Trình Tầm Soát Ung Thư Sớm: Thấu Hiểu Cơ Thể - Đón Đầu Sức Khỏe",
        "subtitle": "Gói khám tầm soát ung thư tiêu hóa, phổi, gan và tuyến giáp chuyên sâu",
        "tag": "PHÒNG NGỪA CHỦ ĐỘNG"
    },
    {
        "filename": "sinh-hoat-clb-benh-nhan-tieu-duong.jpg",
        "source": "articles/tam-soat-tieu-duong.jpg",
        "category": "CÂU LẠC BỘ BỆNH NHÂN",
        "title": "Sinh Hoạt Định Kỳ CLB Đái Tháo Đường & Tăng Huyết Áp",
        "subtitle": "Giao lưu bác sĩ, hướng dẫn tự đo đường huyết và thực đơn sống khỏe mỗi ngày",
        "tag": "ĐỒNG HÀNH SỐNG KHỎE"
    },
    {
        "filename": "chuong-trinh-trao-qua-benh-nhi.jpg",
        "source": "articles/pediatric-care-clinic.jpg",
        "category": "CÔNG TÁC XÃ HỘI",
        "title": "Chương Trình 'Trao Gửi Yêu Thương': Tặng Quà Cho Bệnh Nhi Nội Trú",
        "subtitle": "Đem lại nụ cười, niềm vui và sự khích lệ ấm áp cho các bé vượt qua bệnh tật",
        "tag": "VÒNG TAY NHÂN ÁI"
    },
    {
        "filename": "ngay-hoi-the-thao-benh-vien.jpg",
        "source": "articles/cv-gym.jpg",
        "category": "HỘI THAO NỘI BỘ",
        "title": "Hội Thao Thường Niên Cán Bộ Nhân Viên Bệnh Viện HealthCare",
        "subtitle": "Giao lưu bóng đá, cầu lông, kéo co và rèn luyện thể lực cho đội ngũ y bác sĩ",
        "tag": "RÈN LUYỆN SỨC KHỎE"
    },
    {
        "filename": "gala-vinh-danh-blouse-trang-xuat-sac.jpg",
        "source": "branches/branch-hospital-exterior.jpg",
        "category": "GALA VINH DANH",
        "title": "Đêm Gala Tri Ân & Vinh Danh Các Chiến Sĩ Áo Trắng Xuất Sắc",
        "subtitle": "Tổng kết chặng đường cống hiến y khoa và biểu dương tập thể xuất sắc toàn diện",
        "tag": "TỰ HÀO HEALTHCARE"
    },
    {
        "filename": "phat-dong-phong-trao-ve-sinh-tay.jpg",
        "source": "articles/cv-vaccine-gloves.jpg",
        "category": "KIỂM SOÁT NHIỄM KHUẨN",
        "title": "Lễ Phát Động Phong Trào: Vệ Sinh Tay Bệnh Viện Vì An Toàn Người Bệnh",
        "subtitle": "Cam kết tuân thủ 5 thời điểm vệ sinh tay chuẩn Bộ Y tế và WHO",
        "tag": "AN TOÀN BỆNH VIỆN"
    },

    # Batch 2: 27 events expanding to 50 total
    {
        "filename": "dien-tap-cap-cuu-tham-hoa.jpg",
        "source": "articles/cap-cuu.jpg",
        "category": "DIỄN TẬP CẤP CỨU",
        "title": "Diễn Tập Cấp Cứu Thảm Họa & Xử Trí Chấn Thương Hàng Loạt",
        "subtitle": "Phối hợp kích hoạt quy trình Báo Động Đỏ nội viện (Code Red)",
        "tag": "BÁO ĐỘNG ĐỎ"
    },
    {
        "filename": "hoi-thao-chuyen-doi-so-y-te.jpg",
        "source": "articles/cv-telemed-tablet.jpg",
        "category": "CHUYỂN ĐỔI SỐ",
        "title": "Hội Thảo Quốc Tế: Chuyển Đổi Số & Trí Tuệ Nhân Tạo Trong Y Tế",
        "subtitle": "Ứng dụng bệnh án điện tử EMR và hội chẩn khám bệnh từ xa Telemedicine",
        "tag": "Y TẾ THÔNG MINH"
    },
    {
        "filename": "ngay-hoi-cham-soc-suc-khoe-phu-nu.jpg",
        "source": "articles/san-phu-khoa.jpg",
        "category": "SỨC KHỎE PHỤ NỮ",
        "title": "Ngày Hội Phái Đẹp Tỏa Sáng: Tầm Soát Ung Thư Vú & Cổ Tử Cung",
        "subtitle": "Miễn phí siêu âm tuyến vú, Pap smear và tư vấn sức khỏe tiền mãn kinh",
        "tag": "VÌ NỬA THẾ GIỚI"
    },
    {
        "filename": "hoi-thao-tien-bo-chan-doan-hinh-anh.jpg",
        "source": "articles/cv-neuro-mri-room.jpg",
        "category": "CHẨN ĐOÁN HÌNH ẢNH",
        "title": "Hội Thảo Khoa Học: Đột Phá Chẩn Đoán Hình Ảnh Với MRI 3.0 Tesla",
        "subtitle": "Tối ưu hóa phát hiện sớm tổn thương thần kinh sọ não và bệnh lý khối u",
        "tag": "CHẨN ĐOÁN TIÊN TIẾN"
    },
    {
        "filename": "lop-hoc-tien-san-hanh-trinh-lam-me.jpg",
        "source": "articles/cv-pregnant-ultrasound.jpg",
        "category": "LỚP HỌC TIỀN SẢN",
        "title": "Lớp Học Tiền Sản Miễn Phí: Hành Trình Làm Mẹ An Nhiên",
        "subtitle": "Bác sĩ sản phụ khoa hướng dẫn kỹ năng thở giảm đau và chăm sóc bé sơ sinh",
        "tag": "ĐỒNG HÀNH VƯỢT CẠN"
    },
    {
        "filename": "toa-dam-y-hoc-co-truyen-ket-hop-hien-dai.jpg",
        "source": "articles/y-hoc-co-truyen.jpg",
        "category": "Y HỌC CỔ TRUYỀN",
        "title": "Tọa Đàm Khoa Học: Kết Hợp Y Học Cổ Truyền Và Y Học Hiện Đại",
        "subtitle": "Ứng dụng châm cứu, bấm huyệt và thảo dược chuẩn hóa trong điều trị đau",
        "tag": "TINH HOA Y HỌC"
    },
    {
        "filename": "ngay-hoi-nu-cuoi-hoc-duong.jpg",
        "source": "articles/rang-ham-mat.jpg",
        "category": "NHA KHOA HỌC ĐƯỜNG",
        "title": "Ngày Hội Nha Khoa Học Đường: Nụ Cười Xinh - Tương Lai Sáng",
        "subtitle": "Khám răng miễn phí, bôi vecni fluor và hướng dẫn chăm sóc răng miệng đúng cách",
        "tag": "NỤ CƯỜI TƯƠNG LAI"
    },
    {
        "filename": "tap-huan-an-toan-su-dung-thuoc-duoc-lam-sang.jpg",
        "source": "articles/cv-meds-blister.jpg",
        "category": "DƯỢC LÂM SÀNG",
        "title": "Tập Huấn Toàn Viện: An Toàn Sử Dụng Thuốc & Dược Lâm Sàng",
        "subtitle": "Giảm thiểu tương tác thuốc bất lợi và tối ưu hóa liều kháng sinh điều trị",
        "tag": "AN TOÀN DƯỢC"
    },
    {
        "filename": "hoi-thao-nghien-cuu-gen-va-y-hoc-chinh-xac.jpg",
        "source": "articles/cv-lab-dna.jpg",
        "category": "Y HỌC PHÂN TỬ",
        "title": "Hội Thảo Quốc Tế: Di Truyền Học & Y Học Chính Xác Cá Thể Hóa",
        "subtitle": "Giải trình tự gen thế hệ mới NGS và ứng dụng trong điều trị ung thư trúng đích",
        "tag": "Y HỌC TƯƠNG LAI"
    },
    {
        "filename": "ngay-hoi-hoi-sinh-van-dong.jpg",
        "source": "articles/cv-physio-knee.jpg",
        "category": "PHỤC HỒI CHỨC NĂNG",
        "title": "Ngày Hội Phục Hồi Chức Năng: Hồi Sinh Vận Động Sau Bệnh Lý",
        "subtitle": "Vật lý trị liệu chuyên sâu giúp bệnh nhân hồi phục vận động sau phẫu thuật",
        "tag": "BƯỚC ĐI TỰ LẬP"
    },
    {
        "filename": "kham-sang-loc-benh-ly-ho-hap.jpg",
        "source": "articles/ho-hap.jpg",
        "category": "BỆNH LÝ HÔ HẤP",
        "title": "Chiến Dịch Tầm Soát: Lá Phổi Khỏe Mạnh - Đẩy Lùi Hen & COPD",
        "subtitle": "Đo chức năng hô hấp miễn phí và sàng lọc bệnh phổi tắc nghẽn mạn tính",
        "tag": "LÁ PHỔI KHỎE MẠNH"
    },
    {
        "filename": "chien-dich-tam-soat-gan-mat-tieu-hoa.jpg",
        "source": "articles/cv-endoscopy.jpg",
        "category": "TIÊU HÓA GAN MẬT",
        "title": "Chiến Dịch Tầm Soát: Vì Một Lá Gan Khỏe - Tiêu Hóa An Lành",
        "subtitle": "Xét nghiệm men gan, tầm soát viêm gan virus và nội soi tiêu hóa không đau",
        "tag": "TIÊU HÓA AN TÂM"
    },
    {
        "filename": "hoi-thao-khoa-hoc-nhi-khoa-lam-sang.jpg",
        "source": "articles/cv-nurse-child.jpg",
        "category": "NHI KHOA LÂM SÀNG",
        "title": "Hội Thảo Khoa Học: Cập Nhật Phác Đồ Điều Trị Nhi Khoa Toàn Diện",
        "subtitle": "Kiểm soát sốt co giật, nhiễm trùng hô hấp cấp và dị ứng thức ăn ở trẻ nhỏ",
        "tag": "BẢO VỆ MẦM NON"
    },
    {
        "filename": "tuan-le-nang-cao-nhan-thuc-loang-xuong.jpg",
        "source": "articles/co-xuong-khop.jpg",
        "category": "CƠ XƯƠNG KHỚP",
        "title": "Tuần Lễ Sức Khỏe Xương Khớp: Phòng Ngừa Loãng Xương & Thoái Hóa",
        "subtitle": "Đo mật độ xương DXA tiêu chuẩn vàng và tư vấn dinh dưỡng chắc khỏe xương",
        "tag": "KHUNG XƯƠNG KHỎE"
    },
    {
        "filename": "kham-sang-loc-benh-ly-tuyen-giap.jpg",
        "source": "articles/cv-lab-microscope.jpg",
        "category": "NỘI TIẾT TUYẾN GIÁP",
        "title": "Chương Trình Khám Tầm Soát Bệnh Lý Tuyến Giáp & Rối Loạn Nội Tiết",
        "subtitle": "Siêu âm tuyến giáp Doppler màu và xét nghiệm hormone TSH tầm soát sớm u bướu",
        "tag": "NỘI TIẾT KHỎE"
    },
    {
        "filename": "hoi-nghi-khoa-hoc-kiem-soat-nhiem-khuan.jpg",
        "source": "articles/cv-hospital-hall.jpg",
        "category": "KIỂM SOÁT NHIỄM KHUẨN",
        "title": "Hội Nghị Khoa Học Thường Niên: Kiểm Soát Nhiễm Khuẩn Bệnh Viện",
        "subtitle": "Xây dựng môi trường bệnh viện vô khuẩn, an toàn tối đa cho phòng mổ và ICU",
        "tag": "CHUẨN AN TOÀN"
    },
    {
        "filename": "ngay-hoi-hien-mau-giot-hong-blouse-trang.jpg",
        "source": "articles/cv-lab-blood-samples.jpg",
        "category": "HIẾN MÁU NHÂN ĐẠO",
        "title": "Ngày Hội Hiến Máu: Giọt Hồng Blouse Trắng - Thắp Sáng Hy Vọng",
        "subtitle": "Đội ngũ thầy thuốc xung kích sẻ chia giọt máu quý giá cứu giúp người bệnh",
        "tag": "TRÁCH NHIỆM ÁO TRẮNG"
    },
    {
        "filename": "le-trao-hoc-bong-y-khoa-tai-nang-tre.jpg",
        "source": "branches/branch-cardio-center.jpg",
        "category": "HỌC BỔNG Y KHOA",
        "title": "Lễ Trao Học Bổng Y Khoa: Ươm Mầm Tài Năng Thầy Thuốc Tương Lai",
        "subtitle": "Trao tặng 50 suất học bổng toàn phần cho sinh viên y và bác sĩ nội trú xuất sắc",
        "tag": "ƯƠM MẦM TÀI NĂNG"
    },
    {
        "filename": "toa-dam-cham-soc-giam-nhe-cho-benh-nhan-ung-thu.jpg",
        "source": "articles/cv-patient-hand.jpg",
        "category": "CHĂM SÓC GIẢM NHẸ",
        "title": "Tọa Đàm Y Khoa: Chăm Sóc Giảm Nhẹ & Tâm Lý Cho Người Bệnh Ung Thư",
        "subtitle": "Liệu pháp giảm đau đa mô thức và đồng hành nâng đỡ tinh thần cùng gia đình",
        "tag": "THẤU CẢM & CHIA SẺ"
    },
    {
        "filename": "ngay-hoi-suc-khoe-tam-than-va-giam-stress.jpg",
        "source": "articles/cv-calm.jpg",
        "category": "SỨC KHỎE TÂM TRÍ",
        "title": "Ngày Hội Sức Khỏe Tâm Trí: Cân Bằng Thân - Tâm - Trí Thời Hiện Đại",
        "subtitle": "Tham vấn tâm lý miễn phí, giảm stress và thực hành thiền tĩnh tâm tái tạo năng lượng",
        "tag": "BÌNH YÊN TÂM TRÍ"
    },
    {
        "filename": "le-ra-mat-tong-dai-cap-cuu-115-thong-minh.jpg",
        "source": "branches/branch-neuro-stroke-center.jpg",
        "category": "CẤP CỨU NGOẠI VIỆN",
        "title": "Lễ Ra Mắt Hệ Thống Điều Phối Cấp Cứu Ngoại Viện Thông Minh 24/7",
        "subtitle": "Định vị xe cứu thương thời gian thực và kết nối dữ liệu sinh tồn tiền viện",
        "tag": "GIỜ VÀNG CỨU SỐNG"
    },
    {
        "filename": "hoi-thao-da-lieu-va-tham-my-y-khoa-an-toan.jpg",
        "source": "articles/da-lieu.jpg",
        "category": "DA LIỄU & THẨM MỸ",
        "title": "Hội Thảo Da Liễu Học: Thẩm Mỹ Y Khoa Chuẩn Y Đức & An Toàn Lâm Sàng",
        "subtitle": "Công nghệ laser phân đoạn và phác đồ phục hồi da liễu chuyên sâu chuẩn y khoa",
        "tag": "VẺ ĐẸP KHOA HỌC"
    },
    {
        "filename": "chuong-trinh-kham-suc-khoe-nam-khoa-dinh-ky.jpg",
        "source": "articles/nam-khoa-tiet-nieu.jpg",
        "category": "SỨC KHỎE NAM GIỚI",
        "title": "Chương Trình Chăm Sóc Sức Khỏe Nam Giới: Bản Lĩnh Phái Mạnh",
        "subtitle": "Tầm soát u xơ tiền liệt tuyến, rối loạn chuyển hóa và sức khỏe sinh sản nam học",
        "tag": "BẢN LĨNH PHÁI MẠNH"
    },
    {
        "filename": "ngay-hoi-dinh-duong-hoc-va-an-toan-thuc-pham.jpg",
        "source": "articles/dinh-duong-lanh-manh.jpg",
        "category": "DINH DƯỠNG LÂM SÀNG",
        "title": "Ngày Hội Dinh Dưỡng: Bữa Ăn Lành Mạnh - Cuộc Sống Trường Thọ",
        "subtitle": "Tư vấn dinh dưỡng thực dưỡng, chế độ ăn giảm muối bảo vệ tim mạch và thận",
        "tag": "ĂN SẠCH SỐNG KHỎE"
    },
    {
        "filename": "khanh-thanh-co-so-moi-trung-tam-kham-theo-yeu-cau.jpg",
        "source": "branches/branch-regional-campus.jpg",
        "category": "MỞ RỘNG MẠNG LƯỚI",
        "title": "Lễ Khánh Thành Phân Hiệu Mới: Trung Tâm Khám & Điều Trị Kỹ Thuật Cao",
        "subtitle": "Nâng công suất tiếp đón phục vụ hơn 3.000 lượt người bệnh mỗi ngày",
        "tag": "PHÁT TRIỂN MẠNG LƯỚI"
    },
    {
        "filename": "hoi-thi-sang-kien-cai-tien-chat-luong-kizen.jpg",
        "source": "branches/branch-clinic-2.jpg",
        "category": "CẢI TIẾN CHẤT LƯỢNG",
        "title": "Hội Thi Sáng Kiến Cải Tiến Chất Lượng Bệnh Viện Kaizen Thường Niên",
        "subtitle": "Biểu dương 30 sáng kiến rút ngắn thời gian chờ khám và nâng cao hài lòng người bệnh",
        "tag": "ĐỔI MỚI LIÊN TỤC"
    },
    {
        "filename": "giao-luu-quoc-te-bac-si-noi-tru-asean.jpg",
        "source": "branches/branch-diagnostic-wing.jpg",
        "category": "HỢP TÁC ASEAN",
        "title": "Diễn Đàn Giao Lưu Y Khoa & Đào Tạo Bác Sĩ Nội Trú Khu Vực ASEAN",
        "subtitle": "Kết nối bác sĩ trẻ, trao đổi ca lâm sàng phức tạp và mở rộng hợp tác y khoa",
        "tag": "HỘI NHẬP QUỐC TẾ"
    },

    # Batch 3: 20 more events requested by user (Total 70 events)
    {
        "filename": "hoi-nghi-khoa-hoc-duoc-lieu-va-thuoc-moi.jpg",
        "source": "articles/cv-meds-bottle.jpg",
        "category": "DƯỢC HỌC PHÁT TRIỂN",
        "title": "Hội Thảo Khoa Học: Tiến Bộ Phát Triển Dược Liệu & Thuốc Mới",
        "subtitle": "Nghiên cứu thử nghiệm lâm sàng và ứng dụng công nghệ sinh dược học",
        "tag": "DƯỢC HỌC TIÊN TIẾN"
    },
    {
        "filename": "toa-dam-tang-huyet-ap-va-suc-khoe-tim-mach.jpg",
        "source": "articles/cv-cardio-bp-device.jpg",
        "category": "TIM MẠCH LÂM SÀNG",
        "title": "Tọa Đàm Khoa Học: Kiểm Soát Huyết Áp Toàn Diện Chuẩn Quốc Tế",
        "subtitle": "Chiến lược phối hợp thuốc hạ áp và kiểm soát tăng huyết áp kháng trị",
        "tag": "KIỂM SOÁT HUYẾT ÁP"
    },
    {
        "filename": "ngay-hoi-tu-van-suc-khoe-tien-hon-nhan.jpg",
        "source": "articles/cv-doc-patient.jpg",
        "category": "SỨC KHỎE SINH SẢN",
        "title": "Ngày Hội Tư Vấn Sức Khỏe Tiền Hôn Nhân & Sàng Lọc Di Truyền",
        "subtitle": "Khám sức khỏe sinh sản, tư vấn gen di truyền và phòng ngừa bệnh Thalassemia",
        "tag": "HẠNH PHÚC GIA ĐÌNH"
    },
    {
        "filename": "hoi-thao-phong-ngua-viem-loet-da-day-hp.jpg",
        "source": "articles/viem-loet-da-day.jpg",
        "category": "TIÊU HÓA DẠ DÀY",
        "title": "Chiến Dịch Truyền Thông: Đẩy Lùi Viêm Loét Dạ Dày & Vi Khuẩn HP",
        "subtitle": "Tư vấn phác đồ tiệt trừ Helicobacter pylori và dinh dưỡng bảo vệ dạ dày",
        "tag": "DẠ DÀY AN TÂM"
    },
    {
        "filename": "kham-sang-loc-benh-ly-tai-mui-hong-hoc-duong.jpg",
        "source": "articles/tai-mui-hong.jpg",
        "category": "TAI MŨI HỌNG NHI",
        "title": "Chương Trình Khám Tầm Soát Tai Mũi Họng Cho Trẻ Mầm Non",
        "subtitle": "Nội soi tai mũi họng tầm soát viêm amidan quá phát và viêm tai giữa ứ dịch",
        "tag": "TAI MŨI HỌNG NHI"
    },
    {
        "filename": "hoi-nghi-khoa-hoc-hoi-suc-cap-cuu-icu.jpg",
        "source": "articles/cv-hospital-beds.jpg",
        "category": "HỒI SỨC CẤP CỨU",
        "title": "Hội Nghị Khoa Học Thường Niên: Hồi Sức Tích Cực & Chống Độc ICU",
        "subtitle": "Cập nhật liệu pháp thở máy bảo vệ phổi và kỹ thuật lọc máu liên tục CRRT",
        "tag": "HỒI SỨC TÍCH CỰC"
    },
    {
        "filename": "chien-dich-truyen-thong-song-khoe-giam-muoi.jpg",
        "source": "articles/cv-cooking.jpg",
        "category": "DINH DƯỠNG TIM MẠCH",
        "title": "Chiến Dịch Quốc Gia: Giảm Muối Trong Bữa Ăn - Bảo Vệ Trái Tim",
        "subtitle": "Hướng dẫn nêm nếm gia vị thông minh nhằm giảm gánh nặng huyết áp và thận",
        "tag": "ĂN LÀNH SỐNG KHỎE"
    },
    {
        "filename": "hoi-thao-dot-pha-tri-lieu-te-bao-goc.jpg",
        "source": "articles/cv-lab-tubes.jpg",
        "category": "Y HỌC TÁI TẠO",
        "title": "Hội Thảo Khoa Học: Ứng Dụng Liệu Pháp Tế Bào Gốc Trong Y Học",
        "subtitle": "Đột phá tế bào gốc trung mô trong điều trị thoái hóa khớp gối và xơ gan",
        "tag": "Y HỌC TÁI TẠO"
    },
    {
        "filename": "ngay-hoi-kham-sang-loc-benh-ly-cot-song.jpg",
        "source": "articles/thoai-hoa-cot-song.jpg",
        "category": "CỘT SỐNG VỮNG VÀNG",
        "title": "Ngày Hội Tầm Soát: Thoát Vị Đĩa Đệm & Thoái Hóa Cột Sống",
        "subtitle": "Khám chuyên khoa cột sống, chỉ định MRI và tư vấn vật lý trị liệu bảo tồn",
        "tag": "CỘT SỐNG VỮNG VÀNG"
    },
    {
        "filename": "hoi-thao-cham-soc-giam-nhe-noi-tru.jpg",
        "source": "articles/cv-doc-female-tele.jpg",
        "category": "VĂN HÓA Y ĐỨC",
        "title": "Khóa Huấn Luyện Nội Bộ: Kỹ Năng Giao Tiếp Y Khoa & Thấu Cảm",
        "subtitle": "Đào tạo kỹ năng tư vấn giải thích chuyên môn và xoa dịu tâm lý thân nhân",
        "tag": "VĂN HÓA Y ĐỨC"
    },
    {
        "filename": "chien-dich-tam-soat-ung-thu-da.jpg",
        "source": "articles/cv-skincare.jpg",
        "category": "DA LIỄU UNG BƯỚU",
        "title": "Chiến Dịch Tầm Soát Nốt Ruồi & Phát Hiện Sớm Ung Thư Da",
        "subtitle": "Soi da Dermoscopy kỹ thuật số phóng đại 100 lần tầm soát tổn thương tiền ung thư",
        "tag": "LÀN DA KHỎE ĐẸP"
    },
    {
        "filename": "ngay-hoi-gia-dinh-blouse-trang-gan-ket.jpg",
        "source": "articles/cv-meditation.jpg",
        "category": "ĐỜI SỐNG NỘI BỘ",
        "title": "Ngày Hội Gia Đình Blouse Trắng: Gắn Kết Yêu Thương - Tiếp Lửa Y Đức",
        "subtitle": "Hoạt động dã ngoại tri ân người thân và gia đình của cán bộ y tế toàn viện",
        "tag": "MÁI NHÀ HEALTHCARE"
    },
    {
        "filename": "le-ky-niem-thanh-lap-vien-tim-mach.jpg",
        "source": "branches/branch-hospital.jpg",
        "category": "KỶ NIỆM BỆNH VIỆN",
        "title": "Lễ Kỷ Niệm 15 Năm Thành Lập Viện Tim Mạch Bệnh Viện HealthCare",
        "subtitle": "Chặng đường can thiệp cứu sống hơn 30.000 trái tim và phát triển kỹ thuật cao",
        "tag": "15 NĂM CỐNG HIẾN"
    },
    {
        "filename": "toa-dam-giai-phap-dinh-duong-cho-tre-bieng-an.jpg",
        "source": "articles/tre-bieng-an.jpg",
        "category": "DINH DƯỠNG NHI",
        "title": "Tọa Đàm Y Khoa: Giải Pháp Khoa Học Cho Trẻ Biếng Ăn & Chậm Tăng Cân",
        "subtitle": "Bác sĩ dinh dưỡng hướng dẫn xây dựng thực đơn khoa học kích thích tiêu hóa",
        "tag": "BÉ KHỎE MẸ AN TÂM"
    },
    {
        "filename": "hoi-thao-phong-ngua-tai-bien-mach-mau-nao.jpg",
        "source": "articles/cv-neuro-mri-scans.jpg",
        "category": "THẦN KINH MẠCH MÁU",
        "title": "Hội Thảo Chuyên Đề: Dự Phòng Thứ Phát Đột Quỵ & Phình Mạch Não",
        "subtitle": "Cập nhật kỹ thuật can thiệp nút phình mạch bằng coil và stent chuyển dòng",
        "tag": "ĐỘT PHÁ THẦN KINH"
    },
    {
        "filename": "le-khanh-thanh-khu-phuc-hop-nhi-khoa-quoc-te.jpg",
        "source": "branches/branch-pediatric-wing.jpg",
        "category": "KHÁNH THÀNH KHỐI NHI",
        "title": "Lễ Khánh Thành Khu Phức Hợp Điều Trị Nhi Khoa Tiêu Chuẩn Quốc Tế",
        "subtitle": "Không gian khám chữa bệnh thân thiện, đầy màu sắc giúp các bé an tâm trị liệu",
        "tag": "THẾ GIỚI CỦA BÉ"
    },
    {
        "filename": "ngay-hoi-cham-soc-mat-cho-nguoi-cao-tuoi.jpg",
        "source": "articles/cham-soc-suc-khoe-tong-quat.jpg",
        "category": "MẮT LÃO KHOA",
        "title": "Ngày Hội Mắt Sáng Tuổi Vàng: Tầm Soát Đục Thủy Tinh Thể & Cườm",
        "subtitle": "Khám mắt miễn phí, đo nhãn áp và tư vấn phẫu thuật Phaco thay thủy tinh thể",
        "tag": "MẮT SÁNG TUỔI VÀNG"
    },
    {
        "filename": "hoi-thao-y-hoc-the-thao-va-chan-thuong.jpg",
        "source": "articles/cv-xray-knee.jpg",
        "category": "Y HỌC THỂ THAO",
        "title": "Hội Thảo Y Học Thể Thao: Tái Tạo Dây Chằng & Chấn Thương Vận Động",
        "subtitle": "Phẫu thuật nội soi khớp gối ít xâm lấn giúp vận động viên sớm trở lại thi đấu",
        "tag": "Y HỌC THỂ THAO"
    },
    {
        "filename": "chien-dich-truyen-thong-su-dung-khang-sinh-co-trach-nhiem.jpg",
        "source": "articles/cv-vaccine-syringe.jpg",
        "category": "Y TẾ DỰ PHÒNG",
        "title": "Tuần Lễ Toàn Cầu: Sử Dụng Kháng Sinh Có Trách Nhiệm - Chống Kháng Thuốc",
        "subtitle": "Cam kết không tự ý mua kháng sinh, tuân thủ đúng liều lượng và thời gian điều trị",
        "tag": "BẢO VỆ KHÁNG SINH"
    },
    {
        "filename": "le-vinh-danh-cong-trinh-nghien-cuu-y-khoa-xuat-sac.jpg",
        "source": "branches/branch-building.jpg",
        "category": "NGHIÊN CỨU KHOA HỌC",
        "title": "Lễ Vinh Danh Công Trình Nghiên Cứu Y Khoa & Đề Tài Sáng Tạo Cấp Bộ",
        "subtitle": "Trao giải thưởng cho 15 công trình nghiên cứu lâm sàng xuất sắc toàn diện",
        "tag": "TỰ HÀO NGHIÊN CỨU"
    }
]

TARGET_WIDTH = 1280
TARGET_HEIGHT = 720

def create_event_image(spec):
    source_rel = spec["source"]
    source_path = os.path.join(MEDIA_DIR, source_rel.replace("/", os.sep))
    if not os.path.exists(source_path):
        print(f"Warning: source not found {source_path}")
        return

    # Open base image
    base = Image.open(source_path).convert("RGBA")
    
    # Resize and crop to 16:9 (1280x720)
    w, h = base.size
    target_ratio = TARGET_WIDTH / TARGET_HEIGHT
    current_ratio = w / h
    
    if current_ratio > target_ratio:
        new_w = int(h * target_ratio)
        offset = (w - new_w) // 2
        base = base.crop((offset, 0, offset + new_w, h))
    else:
        new_h = int(w / target_ratio)
        offset = (h - new_h) // 2
        base = base.crop((0, offset, w, offset + new_h))
        
    base = base.resize((TARGET_WIDTH, TARGET_HEIGHT), Image.Resampling.LANCZOS)

    # Slight contrast and brightness polish
    enhancer = ImageEnhance.Contrast(base)
    base = enhancer.enhance(1.05)

    # Create dark gradient overlay for bottom text legibility
    gradient = Image.new("RGBA", (TARGET_WIDTH, TARGET_HEIGHT), (0, 0, 0, 0))
    draw_grad = ImageDraw.Draw(gradient)
    
    for y in range(TARGET_HEIGHT):
        # Top 30% clean, bottom 70% gently darkens
        if y > int(TARGET_HEIGHT * 0.25):
            alpha = int(220 * ((y - TARGET_HEIGHT * 0.25) / (TARGET_HEIGHT * 0.75)) ** 1.3)
            # Tint with subtle teal navy
            draw_grad.line([(0, y), (TARGET_WIDTH, y)], fill=(12, 35, 45, alpha))

    # Also subtle top vignette
    for y in range(int(TARGET_HEIGHT * 0.2)):
        alpha = int(140 * (1 - y / (TARGET_HEIGHT * 0.2)))
        draw_grad.line([(0, y), (TARGET_WIDTH, y)], fill=(8, 25, 32, alpha))

    base = Image.alpha_composite(base, gradient)
    draw = ImageDraw.Draw(base)

    # Fonts
    try:
        font_brand = ImageFont.truetype(FONT_SEGOE, 22)
        font_tag = ImageFont.truetype(FONT_BOLD, 15)
        font_category = ImageFont.truetype(FONT_BOLD, 16)
        font_title = ImageFont.truetype(FONT_SEGOE, 38)
        font_subtitle = ImageFont.truetype(FONT_REGULAR, 22)
    except Exception:
        font_brand = ImageFont.load_default()
        font_tag = ImageFont.load_default()
        font_category = ImageFont.load_default()
        font_title = ImageFont.load_default()
        font_subtitle = ImageFont.load_default()

    # 1. Top Brand Header Bar
    # Hospital Logo / Brand pill
    logo_bg = (15, 118, 110, 230) # Teal
    draw.rounded_rectangle([(40, 30), (330, 75)], radius=10, fill=logo_bg)
    draw.text((58, 41), "HEALTHCARE HOSPITAL", font=font_brand, fill=WHITE)

    # Event Tag on top right
    tag_text = spec.get("tag", "SỰ KIỆN")
    tag_bg = (234, 179, 8, 240) # Gold
    tag_bbox = draw.textbbox((0, 0), tag_text, font=font_tag)
    tag_w = tag_bbox[2] - tag_bbox[0]
    draw.rounded_rectangle([(TARGET_WIDTH - 60 - tag_w - 30, 32), (TARGET_WIDTH - 40, 72)], radius=8, fill=tag_bg)
    draw.text((TARGET_WIDTH - 60 - tag_w - 15, 42), tag_text, font=font_tag, fill=(20, 20, 20))

    # 2. Bottom Content Box
    # Category badge
    cat_text = "●  " + spec["category"]
    draw.rounded_rectangle([(40, 480), (360, 520)], radius=6, fill=(13, 148, 136, 240))
    draw.text((56, 490), cat_text, font=font_category, fill=WHITE)

    # Title
    title_text = spec["title"]
    # Wrap title if too long
    if len(title_text) > 48:
        # split near middle
        words = title_text.split(" ")
        mid = len(words) // 2
        line1 = " ".join(words[:mid])
        line2 = " ".join(words[mid:])
        draw.text((40, 532), line1, font=font_title, fill=WHITE)
        draw.text((40, 580), line2, font=font_title, fill=WHITE)
        draw.text((40, 642), spec["subtitle"], font=font_subtitle, fill=MINT_LIGHT)
    else:
        draw.text((40, 540), title_text, font=font_title, fill=WHITE)
        draw.text((40, 608), spec["subtitle"], font=font_subtitle, fill=MINT_LIGHT)

    # Accent decorative bottom line
    draw.rectangle([(40, 690), (1240, 694)], fill=(13, 148, 136, 180))

    # Save final JPG
    out_path = os.path.join(EVENTS_DIR, spec["filename"])
    final = base.convert("RGB")
    final.save(out_path, "JPEG", quality=92, optimize=True)
    print(f"Generated: {spec['filename']} ({os.path.getsize(out_path):,} bytes)")

def main():
    print(f"Generating {len(EVENTS_SPECS)} hospital event images into {EVENTS_DIR}...")
    for spec in EVENTS_SPECS:
        create_event_image(spec)
    print("Done generating all event images!")

if __name__ == "__main__":
    main()
