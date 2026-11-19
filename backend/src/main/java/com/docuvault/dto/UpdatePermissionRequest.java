package com.docuvault.dto;

import jakarta.validation.constraints.NotBlank;

public record UpdatePermissionRequest(
        @NotBlank(message = "Permission is required")
        String permission
) {}
