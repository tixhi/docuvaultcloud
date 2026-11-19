package com.docuvault.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record UpdateProfileRequest(
        @JsonProperty("fullName") String fullName,
        @JsonProperty("avatarUrl") String avatarUrl
) {}
