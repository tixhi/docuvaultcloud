package com.docuvault.dto;

import com.docuvault.entity.Share;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.UUID;

public record ShareDto(
        UUID id,
        @JsonProperty("file_id") UUID fileId,
        @JsonProperty("folder_id") UUID folderId,
        @JsonProperty("shared_by") UUID sharedBy,
        @JsonProperty("shared_with") UUID sharedWith,
        String permission,
        @JsonProperty("public_token") String publicToken,
        @JsonProperty("expires_at") Instant expiresAt,
        @JsonProperty("created_at") Instant createdAt,
        @JsonProperty("original_name") String originalName,
        @JsonProperty("mime_type") String mimeType,
        @JsonProperty("size_bytes") Long sizeBytes,
        @JsonProperty("shared_by_name") String sharedByName,
        @JsonProperty("shared_with_name") String sharedWithName,
        @JsonProperty("shared_with_email") String sharedWithEmail
) {
    public static ShareDto fromEntity(Share share) {
        if (share == null) return null;
        return new ShareDto(
                share.getId(),
                share.getFile() != null ? share.getFile().getId() : null,
                share.getFolder() != null ? share.getFolder().getId() : null,
                share.getSharedBy() != null ? share.getSharedBy().getId() : null,
                share.getSharedWith() != null ? share.getSharedWith().getId() : null,
                share.getPermission() != null ? share.getPermission().getValue() : "view",
                share.getPublicToken(),
                share.getExpiresAt(),
                share.getCreatedAt(),
                share.getFile() != null ? share.getFile().getOriginalName() : null,
                share.getFile() != null ? share.getFile().getMimeType() : null,
                share.getFile() != null ? share.getFile().getSizeBytes() : null,
                share.getSharedBy() != null ? share.getSharedBy().getFullName() : null,
                share.getSharedWith() != null ? share.getSharedWith().getFullName() : null,
                share.getSharedWith() != null ? share.getSharedWith().getEmail() : null
        );
    }
}
