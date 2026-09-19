package com.healthcare.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import io.swagger.v3.oas.models.servers.Server;
import io.swagger.v3.oas.models.tags.Tag;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI healthcareOpenAPI() {
        final String bearerAuth = "bearerAuth";
        final String bffHeaderAuth = "bffTokenAuth";

        return new OpenAPI()
            .info(new Info()
                .title("Hệ Sinh Thái Y Tế HealthCare - REST API & OpenAPI Specification")
                .description("""
                    ### HealthCare Enterprise Clinical & Hospital Platform API Documentation
                    Hệ thống API backend chuẩn y tế phục vụ toàn bộ dịch vụ đặt khám, quản lý bệnh án điện tử (EMR),
                    kế hoạch chăm sóc (Care Plan), hỏi đáp y khoa (Health Q&A), tư vấn trực tuyến (Tele-consultation),
                    thanh toán viện phí VietQR, và Trợ lý AI y tế thông minh.

                    #### Xác thực & Bảo mật:
                    - **JWT Bearer**: Truyền `Authorization: Bearer <token>` cho các endpoint yêu cầu quyền PATIENT, DOCTOR, hoặc ADMIN.
                    - **BFF Token**: Hệ thống sử dụng cơ chế bảo mật BFF (Backend-for-Frontend) giữa Vercel Frontend và Render Backend.
                    """)
                .version("1.0.0")
                .contact(new Contact()
                    .name("HealthCare Engineering Team")
                    .email("support@healthcare.id.vn")
                    .url("https://www.healthcare.id.vn"))
                .license(new License().name("Proprietary - HealthCare System").url("https://www.healthcare.id.vn/chinh-sach-bao-mat"))
            )
            .servers(List.of(
                new Server().url("/").description("Current Environment Origin (Same-origin / Reverse Proxy)"),
                new Server().url("https://healthcare-project-iwh7.onrender.com").description("Production Render Backend"),
                new Server().url("https://www.healthcare.id.vn/api/v1").description("Production BFF Gateway"),
                new Server().url("http://localhost:8080").description("Local Development Backend")
            ))
            .tags(List.of(
                new Tag().name("Authentication").description("Đăng ký, đăng nhập, quản lý phiên và làm mới token JWT"),
                new Tag().name("Public Catalog").description("Danh mục cơ sở, chuyên khoa, bác sĩ, gói khám, dịch vụ, bài viết"),
                new Tag().name("Appointment & Booking").description("Đặt lịch khám, giữ chỗ tạm thời, xác thực OTP và đổi/hủy lịch"),
                new Tag().name("Clinical Records & Prescriptions").description("Hồ sơ bệnh án điện tử (EMR), kết quả cận lâm sàng và đơn thuốc"),
                new Tag().name("Patient Care Plans").description("Kế hoạch chăm sóc sức khỏe, theo dõi lộ trình điều trị của bệnh nhân"),
                new Tag().name("Tele-Consultation").description("Tư vấn sức khỏe trực tuyến từ xa giữa bác sĩ và người bệnh"),
                new Tag().name("Health Q&A").description("Diễn đàn hỏi đáp y khoa cộng đồng được bác sĩ chuyên khoa kiểm duyệt"),
                new Tag().name("Payments & Invoices").description("Cổng thanh toán tự động VietQR, đối soát và xử lý webhook ngân hàng"),
                new Tag().name("AI Health Assistant").description("Trợ lý trí tuệ nhân tạo y tế phân luồng triệu chứng và tư vấn"),
                new Tag().name("AI Clinical Review").description("Quy trình bác sĩ kiểm duyệt nội dung chuyên môn phục vụ chỉ mục RAG AI"),
                new Tag().name("CMS & Content Delivery").description("Quản lý nội dung động, giao diện và các slot hiển thị CMS"),
                new Tag().name("User Profile & Preferences").description("Hồ sơ cá nhân, tùy chọn tài khoản và phân quyền người dùng"),
                new Tag().name("File & Object Storage").description("Tải lên, truy xuất và xóa tệp tin, tài liệu y tế"),
                new Tag().name("Synthetic Documents").description("Xuất tệp tóm tắt bệnh án và đơn thuốc định dạng PDF"),
                new Tag().name("Notifications").description("Trung tâm thông báo đẩy và cấu hình nhận thông báo người dùng"),
                new Tag().name("Careers & Recruitment").description("Tuyển dụng nhân sự y tế và tiếp nhận hồ sơ ứng tuyển"),
                new Tag().name("Administration").description("Cổng quản trị dành riêng cho Ban Quản trị hệ thống")
            ))
            .addSecurityItem(new SecurityRequirement().addList(bearerAuth))
            .components(new Components()
                .addSecuritySchemes(bearerAuth, new SecurityScheme()
                    .name(bearerAuth)
                    .type(SecurityScheme.Type.HTTP)
                    .scheme("bearer")
                    .bearerFormat("JWT")
                    .description("Nhập JSON Web Token (JWT) sau khi đăng nhập thành công")
                )
                .addSecuritySchemes(bffHeaderAuth, new SecurityScheme()
                    .name("X-BFF-Service-Token")
                    .type(SecurityScheme.Type.APIKEY)
                    .in(SecurityScheme.In.HEADER)
                    .description("Token xác thực giữa Next.js BFF và Spring Boot Backend")
                )
            );
    }
}
