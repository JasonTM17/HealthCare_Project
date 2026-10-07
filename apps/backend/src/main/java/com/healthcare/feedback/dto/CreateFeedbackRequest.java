package com.healthcare.feedback.dto;

import com.healthcare.feedback.entity.FeedbackCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateFeedbackRequest(
    @NotNull(message = "Vui lòng chọn chủ đề góp ý") FeedbackCategory category,
    @NotBlank(message = "Vui lòng nhập tiêu đề") @Size(max = 200, message = "Tiêu đề tối đa 200 ký tự") String subject,
    @NotBlank(message = "Vui lòng nhập nội dung") @Size(min = 10, max = 2000, message = "Nội dung từ 10 đến 2000 ký tự") String message
) {}
