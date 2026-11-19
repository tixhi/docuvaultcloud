package com.docuvault.dto;

import java.util.List;

public record UsageSummaryDto(
        Long usedBytes,
        Long fileCount,
        Integer quotaMb,
        List<CategoryUsageDto> byCategory,
        List<FileDto> recent
) {}
