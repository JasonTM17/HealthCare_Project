import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const playwrightPath = path.join(rootDir, 'apps', 'frontend', 'node_modules', '@playwright', 'test', 'index.mjs');
const { chromium } = await import(pathToFileURL(playwrightPath).href);

const outputDir = path.join(rootDir, 'apps', 'frontend', 'public', 'media', 'articles', 'illustrations');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const illustrations = [
  {
    filename: 'quy-tac-fast-dot-quy.png',
    title: 'QUY TẮC F.A.S.T - NHẬN DIỆN SỚM CƠN ĐỘT QUỴ NÃO CẤP',
    subtitle: 'Thời gian là não bộ (Time is Brain) · Cửa sổ vàng cấp cứu 4.5 giờ',
    badge: 'Đơn vị Đột quỵ & Hồi sức Cấp cứu · Bệnh viện Đa khoa HealthCare',
    accentColor: '#e11d48',
    bgColor: '#fff1f2',
    cards: [
      { letter: 'F', word: 'FACE (Mặt)', desc: 'Liệt mặt, nụ cười méo lệch, nhân trung lệch sang một bên khi cười hoặc nói chuyện.', color: '#be123c' },
      { letter: 'A', word: 'ARM (Tay chân)', desc: 'Yếu hoặc liệt một bên tay/chân, không thể cùng lúc nâng đều hai cánh tay lên cao.', color: '#c026d3' },
      { letter: 'S', word: 'SPEECH (Lời nói)', desc: 'Nói đớ, nói ngọng, biến đổi giọng nói bất thường hoặc không diễn đạt được câu đơn giản.', color: '#0284c7' },
      { letter: 'T', word: 'TIME (Thời gian)', desc: 'Gọi ngay Cấp cứu 115 hoặc đưa người bệnh đến bệnh viện có đơn vị Đột quỵ gần nhất.', color: '#e11d48' }
    ],
    footerAlert: 'CẢNH BÁO LÂM SÀNG: Tuyệt đối KHÔNG cạo gió, chích lể ngón tay, vắt chanh vào miệng hoặc tự uống An Cung Ngưu Hoàng Hoàn khi chưa chụp CT/MRI não.'
  },
  {
    filename: 'thap-dinh-duong-hop-ly.png',
    title: 'THÁP DINH DƯỠNG CÂN ĐỐI CHO NGƯỜI TRƯỞNG THÀNH',
    subtitle: 'Hướng dẫn xây dựng khẩu phần ăn theo khuyến cáo của Viện Dinh dưỡng Quốc gia',
    badge: 'Khoa Dinh Dưỡng Lâm Sàng · Bệnh viện Đa khoa HealthCare',
    accentColor: '#059669',
    bgColor: '#ecfdf5',
    cards: [
      { letter: '01', word: 'NƯỚC UỐNG & DỊCH THỂ', desc: 'Uống đủ 1.5 - 2.0 lít nước lọc mỗi ngày. Hạn chế nước có gas, đồ ngọt và rượu bia.', color: '#0284c7' },
      { letter: '02', word: 'NGŨ CỐC & TINH BỘT PHỨC', desc: '300 - 400g/ngày. Ưu tiên gạo lứt, yến mạch, khoai lang, bánh mì ngũ cốc nguyên hạt.', color: '#d97706' },
      { letter: '03', word: 'RAU CỦ TƯƠI & HOA QUẢ', desc: 'Rau xanh 400 - 500g, quả chín 200 - 300g/ngày. Bổ sung chất xơ hòa tan và vitamin.', color: '#16a34a' },
      { letter: '04', word: 'ĐẠM NẠC, CÁ BÉO & ĐẬU', desc: 'Cá biển giàu Omega-3, thịt gia cầm nạc (150-200g/ngày), các loại đậu hạt, giảm thịt đỏ.', color: '#e11d48' },
      { letter: '05', word: 'MUỐI (<5g) & ĐƯỜNG (<25g)', desc: 'Ăn nhạt bảo vệ tim mạch và thận. Giảm đồ kho mặn, thực phẩm chế biến sẵn đóng hộp.', color: '#64748b' }
    ],
    footerAlert: 'LỜI KHUYÊN DINH DƯỠNG: Kết hợp ăn đa dạng trên 15-20 loại thực phẩm mỗi ngày và duy trì vận động thể lực tối thiểu 30 phút mỗi ngày.'
  },
  {
    filename: 'huong-dan-do-duong-huyet.png',
    title: 'BẢNG CHỈ SỐ ĐƯỜNG HUYẾT & HƯỚNG DẪN THEO DÕI TẠI NHÀ',
    subtitle: 'Tiêu chuẩn chẩn đoán theo Hiệp hội Đái tháo đường Hoa Kỳ (ADA) & Bộ Y tế',
    badge: 'Khoa Nội Tiết & Chuyển Hóa · Bệnh viện Đa khoa HealthCare',
    accentColor: '#0284c7',
    bgColor: '#f0f9ff',
    cards: [
      { letter: 'BÌNH THƯỜNG', word: 'Chỉ số mục tiêu an toàn', desc: 'Lúc đói: 70 - 99 mg/dL (3.9 - 5.5 mmol/L) · Sau ăn 2h: < 140 mg/dL (< 7.8 mmol/L) · HbA1c: < 5.7%', color: '#16a34a' },
      { letter: 'TIỀN ĐTĐ', word: 'Giai đoạn cảnh báo sớm', desc: 'Lúc đói: 100 - 125 mg/dL (5.6 - 6.9 mmol/L) · Sau ăn 2h: 140 - 199 mg/dL · HbA1c: 5.7% - 6.4%', color: '#d97706' },
      { letter: 'ĐÁI THÁO ĐƯỜNG', word: 'Cần can thiệp phác đồ y khoa', desc: 'Lúc đói: ≥ 126 mg/dL (≥ 7.0 mmol/L) · Sau ăn 2h: ≥ 200 mg/dL (≥ 11.1 mmol/L) · HbA1c: ≥ 6.5%', color: '#dc2626' }
    ],
    footerAlert: 'QUY TRÌNH ĐO TẠI NHÀ: Rửa tay sạch bằng xà phòng, sát trùng cạnh bên đầu ngón tay, lau khô, bỏ giọt máu đầu, lấy giọt máu thứ hai để đo.'
  },
  {
    filename: 'cham-soc-thai-ky-3-thang.png',
    title: 'LỊCH TRÌNH KHÁM THAI & CÁC MỐC SIÊU ÂM QUAN TRỌNG',
    subtitle: 'Phác đồ theo dõi thai kỳ toàn diện qua 3 tam cá nguyệt bảo vệ mẹ và bé',
    badge: 'Khoa Sản Phụ Khoa & Chẩn Đoán Trước Sinh · Bệnh viện Đa khoa HealthCare',
    accentColor: '#db2777',
    bgColor: '#fdf2f8',
    cards: [
      { letter: 'T1', word: 'TAM CÁ NGUYỆT 1 (Tuần 1 - 13)', desc: 'Xác định tim thai tuần 6-8. MỐC VÀNG tuần 11-13+6: Đo độ mờ da gáy (NT), xét nghiệm Double Test hoặc NIPT tầm soát dị tật NST.', color: '#be185d' },
      { letter: 'T2', word: 'TAM CÁ NGUYỆT 2 (Tuần 14 - 27)', desc: 'MỐC VÀNG tuần 18-22: Siêu âm hình thái học 4D chi tiết từng cơ quan. Tuần 24-28: Nghiệm pháp dung nạp 75g glucose tầm soát ĐTĐ thai kỳ.', color: '#9333ea' },
      { letter: 'T3', word: 'TAM CÁ NGUYỆT 3 (Tuần 28 - 40)', desc: 'Tuần 30-32: Đánh giá tăng trưởng, vị trí nhau và nước ối. Từ tuần 36: Đo Non-stress test (NST) theo dõi tim thai cơn gò định kỳ.', color: '#0284c7' }
    ],
    footerAlert: 'DẤU HIỆU CẦN KHÁM NGAY: Ra máu âm đạo bất thường, đau thắt bụng dưới, phù nhanh hai chân, đau đầu hoa mắt, thai máy yếu dưới 10 cử động/2 giờ.'
  },
  {
    filename: 'ky-thuat-do-huyet-ap.png',
    title: 'QUY TRÌNH ĐO HUYẾT ÁP TẠI NHÀ ĐÚNG CHUẨN LÂM SÀNG',
    subtitle: 'Khuyến cáo của Hội Tim Mạch Học Việt Nam (VNHA) & Phân độ huyết áp',
    badge: 'Viện Tim Mạch & Bệnh Không Lây Nhiễm · Bệnh viện Đa khoa HealthCare',
    accentColor: '#b91c1c',
    bgColor: '#fef2f2',
    cards: [
      { letter: '01', word: 'CHUẨN BỊ TRƯỚC ĐO', desc: 'Nghỉ ngơi yên tĩnh 5 phút. Không uống cà phê, trà đặc, hút thuốc hoặc vận động mạnh trước khi đo 30 phút.', color: '#0369a1' },
      { letter: '02', word: 'TƯ THẾ ĐO CHUẨN', desc: 'Ngồi thẳng lưng tựa vào ghế, hai bàn chân đặt phẳng trên mặt sàn, không bắt chéo chân. Tay đặt ngang tầm tim.', color: '#0d9488' },
      { letter: '03', word: 'QUẤN BĂNG ĐO', desc: 'Quấn bao đo cách nếp khuỷu tay 2-3cm, vừa khít luồn được 1 ngón tay. Ưu tiên máy đo huyết áp bắp tay điện tử chuẩn hóa.', color: '#e11d48' },
      { letter: '04', word: 'ĐO & GHI NHẬT KÝ', desc: 'Giữ yên lặng khi đo. Đo 2 lần cách nhau 1-2 phút và lấy giá trị trung bình. Ghi lại số đo và ngày giờ cụ thể.', color: '#7c3aed' }
    ],
    footerAlert: 'PHÂN ĐỘ: Tối ưu: <120/80 mmHg · Bình thường: 120-129/80-84 mmHg · Tiền tăng HA: 130-139/85-89 mmHg · Tăng huyết áp: ≥140/90 mmHg.'
  },
  {
    filename: 'so-do-gerd-da-day.png',
    title: 'CƠ CHẾ TRÀO NGƯỢC DẠ DÀY THỰC QUẢN (GERD) & DẠ DÀY TÁ TRÀNG',
    subtitle: 'Phân tích cơ chế bệnh sinh, yếu tố nguy cơ và phác đồ điều trị',
    badge: 'Khoa Tiêu Hóa & Gan Mật · Bệnh viện Đa khoa HealthCare',
    accentColor: '#ea580c',
    bgColor: '#fff7ed',
    cards: [
      { letter: 'CƠ CHẾ', word: 'Cơ thắt thực quản dưới (LES) giãn', desc: 'Acid hydrochloric và men pepsin trào ngược gây bỏng rát sau xương ức, ợ chua, viêm trợt loét niêm mạc thực quản và ho khan.', color: '#c2410c' },
      { letter: 'NGUY CƠ', word: 'Yếu tố kích hoạt cơn trào ngược', desc: 'Nhiễm vi khuẩn Helicobacter pylori (HP), stress mãn tính, thức khuya, ăn đồ chua cay béo, nằm ngay sau khi ăn no.', color: '#b91c1c' },
      { letter: 'ĐIỀU TRỊ', word: 'Phác đồ kiểm soát & phục hồi', desc: 'Dùng thuốc kháng tiết acid PPI theo chỉ định bác sĩ, chia nhỏ bữa ăn, kê cao đầu giường 15cm, không ăn trước khi ngủ 3 giờ.', color: '#047857' }
    ],
    footerAlert: 'DẤU HIỆU BÁO ĐỘNG: Nuốt nghẹn, nôn ra máu, đi ngoài phân đen như bã cà phê, sụt cân nhanh cần nội soi thực quản dạ dày ngay.'
  },
  {
    filename: 'cham-soc-viem-da-co-dia.png',
    title: 'PHÁC ĐỒ 4 BƯỚC PHỤC HỒI HÀNG RÀO BẢO VỆ DA',
    subtitle: 'Chăm sóc chuẩn chuyên khoa Da liễu cho bệnh nhân viêm da cơ địa và da nhạy cảm',
    badge: 'Chuyên Khoa Da Liễu & Thẩm Mỹ Da · Bệnh viện Đa khoa HealthCare',
    accentColor: '#4f46e5',
    bgColor: '#eef2ff',
    cards: [
      { letter: 'B1', word: 'TẮM NƯỚC ẤM DƯỚI 10 PHÚT', desc: 'Nhiệt độ nước ấm 34-36°C, không dùng nước quá nóng. Dùng sữa tắm pH 5.5 dịu nhẹ không bọt xà phòng.', color: '#0284c7' },
      { letter: 'B2', word: 'DƯỠNG ẨM TRONG 3 PHÚT VÀNG', desc: 'Thoa kem dưỡng ẩm chứa Ceramide, HA ngay sau khi lau ráo người để khóa ẩm và tái tạo màng lipid bảo vệ.', color: '#059669' },
      { letter: 'B3', word: 'DÙNG THUỐC BÔI ĐÚNG CHỈ ĐỊNH', desc: 'Bôi kem kháng viêm/ức chế miễn dịch tại chỗ đúng liều bác sĩ kê toa trong đợt bùng phát. Không lạm dụng corticoid.', color: '#7c3aed' },
      { letter: 'B4', word: 'KIỂM SOÁT YẾU TỐ MÔI TRƯỜNG', desc: 'Mặc đồ cotton thoáng mát, tránh len dạ, tránh lông chó mèo khói bụi, dùng máy tạo ẩm trong phòng điều hòa.', color: '#ea580c' }
    ],
    footerAlert: 'LƯU Ý QUAN TRỌNG: Cắt ngắn móng tay, không cào gãi chà xát mạnh gây trầy xước nhiễm trùng thứ phát do vi khuẩn tụ cầu.'
  },
  {
    filename: 'quy-trinh-kham-mat-khau-thi-luc.png',
    title: 'QUY TẮC 20-20-20 & HƯỚNG DẪN CHỐNG KHÔ MẮT VĂN PHÒNG',
    subtitle: 'Bảo vệ thị lực và ngăn ngừa Hội chứng thị giác màn hình (Computer Vision Syndrome)',
    badge: 'Chuyên Khoa Mắt & Khúc Xạ Nhãn Khoa · Bệnh viện Đa khoa HealthCare',
    accentColor: '#0891b2',
    bgColor: '#ecfeff',
    cards: [
      { letter: '20-20-20', word: 'Quy tắc nghỉ ngơi điều tiết', desc: 'Cứ mỗi 20 phút nhìn màn hình máy tính/điện thoại, nhìn xa 20 feet (6 mét) trong 20 giây để thư giãn cơ thể mi.', color: '#0e7490' },
      { letter: 'CHỚP MẮT', word: 'Duy trì màng phim nước mắt', desc: 'Chủ động chớp mắt đủ 15-20 lần/phút. Bổ sung nước mắt nhân tạo không chất bảo quản (dạng tép đơn liều) khi làm việc.', color: '#0284c7' },
      { letter: 'ÁNH SÁNG', word: 'Điều chỉnh màn hình & tư thế', desc: 'Đặt màn hình cách mắt 50-60cm, cạnh trên màn hình ngang hoặc thấp hơn tầm mắt 15 độ. Tránh ánh đèn chiếu chói vào màn hình.', color: '#059669' }
    ],
    footerAlert: 'KHÁM MẮT ĐỊNH KỲ: Khám chuyên khoa Mắt 6 tháng/lần để đo thị lực, đo khúc xạ, soi đáy mắt và tầm soát sớm tăng nhãn áp (Glaucoma).'
  }
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1200, height: 780 },
    deviceScaleFactor: 2
  });

  for (const item of illustrations) {
    const cardsHtml = item.cards.map(c => `
      <div style="flex: 1; min-width: 220px; background: #ffffff; border-radius: 12px; padding: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; display: flex; flex-direction: column;">
        <div style="display: inline-flex; align-items: center; justify-content: center; min-width: 44px; height: 44px; border-radius: 8px; background: ${c.color}; color: #ffffff; font-weight: 800; font-size: ${c.letter.length > 5 ? '13px' : '18px'}; padding: 0 10px; margin-bottom: 12px; align-self: flex-start;">
          ${c.letter}
        </div>
        <div style="font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 8px;">${c.word}</div>
        <div style="font-size: 13.5px; line-height: 1.6; color: #475569;">${c.desc}</div>
      </div>
    `).join('');

    const html = `<!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif; }
        body { width: 1200px; height: 780px; background: ${item.bgColor}; display: flex; flex-direction: column; justify-content: space-between; padding: 40px; }
        .header { border-bottom: 2px solid rgba(0,0,0,0.06); padding-bottom: 20px; }
        .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; background: #ffffff; color: ${item.accentColor}; font-size: 13px; font-weight: 700; border: 1px solid ${item.accentColor}33; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
        .title { font-size: 26px; font-weight: 800; color: #0f172a; margin-bottom: 8px; line-height: 1.3; }
        .subtitle { font-size: 15px; color: #475569; font-weight: 500; }
        .cards-grid { display: flex; gap: 16px; margin: 24px 0; flex-wrap: wrap; }
        .footer { background: #ffffff; border-radius: 10px; padding: 14px 20px; border-left: 5px solid ${item.accentColor}; font-size: 13.5px; color: #334155; line-height: 1.5; box-shadow: 0 2px 6px rgba(0,0,0,0.04); }
        .footer strong { color: #0f172a; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="badge">${item.badge}</div>
        <h1 class="title">${item.title}</h1>
        <p class="subtitle">${item.subtitle}</p>
      </div>
      <div class="cards-grid">
        ${cardsHtml}
      </div>
      <div class="footer">
        ${item.footerAlert}
      </div>
    </body>
    </html>`;

    await page.setContent(html, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    const dest = path.join(outputDir, item.filename);
    await page.screenshot({ path: dest, clip: { x: 0, y: 0, width: 1200, height: 780 } });
    console.log('Rendered illustration: ' + item.filename + ' (' + fs.statSync(dest).size + ' bytes)');
  }

  await browser.close();
  console.log('All illustrations generated successfully!');
})();
