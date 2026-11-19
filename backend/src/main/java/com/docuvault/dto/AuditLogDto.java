package com.docuvault.dto;

import com.docuvault.entity.AuditLog;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.time.Instant;
import java.util.UUID;

public record AuditLogDto(
        UUID id,
        @JsonProperty("actor_id") UUID actorId,
        String action,
        @JsonProperty("target_type") String targetType,
        @JsonProperty("target_id") UUID targetId,
        Object metadata,
        @JsonProperty("ip_address") String ipAddress,
        @JsonProperty("created_at") Instant createdAt,
        @JsonProperty("actor_name") String actorName,
        @JsonProperty("actor_email") String actorEmail
) {
    public static AuditLogDto fromEntity(AuditLog log) {
        if (log == null) return null;
        return new AuditLogDto(
                log.getId(),
                log.getActor() != null ? log.getActor().getId() : null,
                log.getAction(),
                log.getTargetType(),
                log.getTargetId(),
                log.getMetadata(),
                log.getIpAddress(),
                log.getCreatedAt(),
                log.getActor() != null ? log.getActor().getFullName() : null,
                log.getActor() != null ? log.getActor().getEmail() : null
        );
    }
}
