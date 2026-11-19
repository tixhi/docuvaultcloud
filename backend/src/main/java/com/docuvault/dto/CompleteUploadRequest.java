package com.docuvault.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record CompleteUploadRequest(
        @NotBlank(message = "key is required")
        String key,

        @NotBlank(message = "fileName is required")
        String fileName,

        @NotBlank(message = "mimeType is required")
        String mimeType,

        @NotNull(message = "sizeBytes is required")
        Long sizeBytes,

        @JsonProperty("folderId")
        UUID folderId
) {}
