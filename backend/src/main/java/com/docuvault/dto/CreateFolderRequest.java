package com.docuvault.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;

import java.util.UUID;

public record CreateFolderRequest(
        @NotBlank(message = "Folder name is required")
        String name,

        @JsonProperty("parentId")
        UUID parentId
) {}
