package com.docuvault.dto;

import com.docuvault.entity.User;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.UUID;

public record UserDto(
        UUID id,
        @JsonProperty("full_name") String fullName,
        String email,
        String role,
        @JsonProperty("avatar_url") String avatarUrl,
        @JsonProperty("storage_quota_mb") Integer storageQuotaMb,
        @JsonProperty("is_active") Boolean isActive,
        @JsonProperty("last_login_at") Instant lastLoginAt,
        @JsonProperty("created_at") Instant createdAt,
        @JsonProperty("updated_at") Instant updatedAt
) {
    public static UserDto fromEntity(User user) {
        if (user == null) return null;
        return new UserDto(
                user.getId(),
                user.getFullName(),
                user.getEmail(),
                user.getRole() != null ? user.getRole().getValue() : "member",
                user.getAvatarUrl(),
                user.getStorageQuotaMb(),
                user.getIsActive(),
                user.getLastLoginAt(),
                user.getCreatedAt(),
                user.getUpdatedAt()
        );
    }
}
