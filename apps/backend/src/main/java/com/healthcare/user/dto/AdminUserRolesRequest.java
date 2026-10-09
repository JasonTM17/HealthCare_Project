package com.healthcare.user.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record AdminUserRolesRequest(
    @NotEmpty
    @Size(max = 3)
    List<@NotBlank @Size(max = 64) String> roles
) {}
