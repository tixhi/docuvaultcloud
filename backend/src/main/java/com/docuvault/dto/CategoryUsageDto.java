package com.docuvault.dto;

import com.fasterxml.jackson.annotation.JsonProperty;

public record CategoryUsageDto(
        String category,
        @JsonProperty("file_count") Long fileCount,
        @JsonProperty("total_bytes") Long totalBytes
) {}
