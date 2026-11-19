package com.docuvault.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.UUID;

public record MoveRequest(
        @JsonProperty("folderId")
        UUID folderId
) {}
