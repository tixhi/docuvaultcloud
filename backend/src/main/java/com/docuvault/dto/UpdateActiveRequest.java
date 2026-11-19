package com.docuvault.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotNull;

public record UpdateActiveRequest(
        @JsonProperty("isActive")
        @NotNull(message = "isActive is required")
        Boolean isActive
) {}
