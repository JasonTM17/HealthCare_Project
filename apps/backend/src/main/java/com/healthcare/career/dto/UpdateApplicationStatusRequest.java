package com.healthcare.career.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdateApplicationStatusRequest(
    @NotBlank(message = "Vui lòng chọn trạng thái hồ sơ.") String status
) {
}
