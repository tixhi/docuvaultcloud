package com.docuvault.dto;

import com.docuvault.entity.Folder;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.UUID;

public record FolderDto(
        UUID id,
        String name,
        @JsonProperty("owner_id") UUID ownerId,
        @JsonProperty("parent_id") UUID parentId,
        @JsonProperty("is_trashed") Boolean isTrashed,
        @JsonProperty("created_at") Instant createdAt,
        @JsonProperty("updated_at") Instant updatedAt
) {
    public static FolderDto fromEntity(Folder folder) {
        if (folder == null) return null;
        return new FolderDto(
                folder.getId(),
                folder.getName(),
                folder.getOwner() != null ? folder.getOwner().getId() : null,
                folder.getParent() != null ? folder.getParent().getId() : null,
                folder.getIsTrashed(),
                folder.getCreatedAt(),
                folder.getUpdatedAt()
        );
    }
}
