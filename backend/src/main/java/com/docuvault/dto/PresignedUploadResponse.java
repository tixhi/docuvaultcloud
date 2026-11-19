package com.docuvault.dto;

import java.util.UUID;

public record PresignedUploadResponse(
        String uploadUrl,
        String key,
        UUID folderId
) {}
