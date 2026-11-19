package com.docuvault.dto;

import com.docuvault.entity.FileRecord;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.UUID;

public record FileDto(
        UUID id,
        @JsonProperty("original_name") String originalName,
        @JsonProperty("mime_type") String mimeType,
        @JsonProperty("size_bytes") Long sizeBytes,
        @JsonProperty("storage_key") String storageKey,
        @JsonProperty("storage_driver") String storageDriver,
        @JsonProperty("checksum_sha256") String checksumSha256,
        @JsonProperty("owner_id") UUID ownerId,
        @JsonProperty("folder_id") UUID folderId,
        Integer version,
        @JsonProperty("is_trashed") Boolean isTrashed,
        @JsonProperty("created_at") Instant createdAt,
        @JsonProperty("updated_at") Instant updatedAt
) {
    public static FileDto fromEntity(FileRecord f) {
        if (f == null) return null;
        return new FileDto(
                f.getId(),
                f.getOriginalName(),
                f.getMimeType(),
                f.getSizeBytes(),
                f.getStorageKey(),
                f.getStorageDriver(),
                f.getChecksumSha256(),
                f.getOwner() != null ? f.getOwner().getId() : null,
                f.getFolder() != null ? f.getFolder().getId() : null,
                f.getVersion(),
                f.getIsTrashed(),
                f.getCreatedAt(),
                f.getUpdatedAt()
        );
    }
}
