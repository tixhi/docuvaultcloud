package com.docuvault.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.UUID;

public record CreateShareRequest(
        @JsonProperty("fileId") UUID fileId,
        @JsonProperty("folderId") UUID folderId,
        String email,
        String permission,
        @JsonProperty("expiresAt") Instant expiresAt,
        @JsonProperty("publicLink") Boolean publicLink
) {}
