package com.docuvault.dto;

import jakarta.validation.constraints.NotBlank;

public record RenameRequest(
        @NotBlank(message = "A new name is required")
        String name
) {}
