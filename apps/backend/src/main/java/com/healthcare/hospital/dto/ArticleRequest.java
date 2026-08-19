package com.healthcare.hospital.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.AssertTrue;

public record ArticleRequest(
    @NotBlank @Size(max = 200) String title,
    @NotBlank @Size(max = 220) String slug,
    @Size(max = 500) String summary,
    @Size(max = 8000) String body,
    boolean active
) {

    @AssertTrue(message = "Bài viết active cần có tóm tắt và nội dung.")
    public boolean hasPublishedContent() {
        return !active
            || (summary != null && !summary.isBlank() && body != null && !body.isBlank());
    }
}
