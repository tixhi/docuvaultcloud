package com.docuvault.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public record PresignUploadRequest(
        @NotBlank(message = "fileName is required")
        String fileName,

        @NotBlank(message = "mimeType is required")
        String mimeType,

        @JsonProperty("folderId")
        UUID folderId
) {}
