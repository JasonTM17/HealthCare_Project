package com.healthcare.auth.dto;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record GoogleProofRequest(
    @NotBlank @Size(max = 8192) @JsonAlias({"idToken", "credential"}) String googleIdToken
) {}
