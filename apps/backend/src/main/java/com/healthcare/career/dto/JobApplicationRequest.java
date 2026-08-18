package com.healthcare.career.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record JobApplicationRequest(
    @NotBlank(message = "Vui lòng nhập họ và tên.")
    @Size(min = 2, max = 160, message = "Họ và tên cần có từ 2 đến 160 ký tự.")
    String fullName,

    @NotBlank(message = "Vui lòng nhập email.")
    @Email(message = "Địa chỉ email chưa đúng định dạng.")
    @Size(max = 254, message = "Địa chỉ email quá dài.")
    String email,

    @NotBlank(message = "Vui lòng nhập số điện thoại.")
    @Pattern(
        regexp = "^(?:\\+84|0)(?:[ .-]?\\d){9,10}$",
        message = "Số điện thoại Việt Nam chưa đúng định dạng."
    )
    String phone,

    @Min(value = 0, message = "Số năm kinh nghiệm không thể nhỏ hơn 0.")
    @Max(value = 60, message = "Số năm kinh nghiệm chưa hợp lệ.")
    Integer yearsExperience,

    @NotBlank(message = "Vui lòng chia sẻ ngắn gọn lý do bạn muốn ứng tuyển.")
    @Size(min = 20, max = 4000, message = "Nội dung giới thiệu cần có từ 20 đến 4.000 ký tự.")
    String coverLetter,

    @Size(max = 1000, message = "Liên kết hồ sơ quá dài.")
    @Pattern(
        regexp = "^$|^https://[^\\s]+$",
        message = "Liên kết hồ sơ cần bắt đầu bằng https://"
    )
    String resumeUrl,

    @AssertTrue(message = "Bạn cần đồng ý cho bệnh viện xử lý thông tin ứng tuyển.")
    boolean privacyConsent
) {
}
