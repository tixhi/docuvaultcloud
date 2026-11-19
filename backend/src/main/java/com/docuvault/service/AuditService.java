package com.docuvault.service;

import com.docuvault.dto.AuditLogDto;
import com.docuvault.entity.AuditLog;
import com.docuvault.entity.User;
import com.docuvault.repository.AuditLogRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    @Transactional
    public void log(User actor, String action, String targetType, UUID targetId, String metadata, String ipAddress) {
        AuditLog log = new AuditLog(actor, action, targetType, targetId, metadata, ipAddress);
        auditLogRepository.save(log);
    }

    @Transactional(readOnly = true)
    public List<AuditLogDto> list(UUID actorId, String action, Instant from, Instant to, int limit, int offset) {
        int page = offset / Math.max(1, limit);
        Pageable pageable = PageRequest.of(page, Math.max(1, limit), Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<AuditLog> result = auditLogRepository.filterLogs(actorId, action, from, to, pageable);
        return result.getContent().stream().map(AuditLogDto::fromEntity).toList();
    }

    @Transactional(readOnly = true)
    public List<AuditLogDto> getUserActivity(UUID userId, int limit) {
        Pageable pageable = PageRequest.of(0, Math.max(1, limit), Sort.by(Sort.Direction.DESC, "createdAt"));
        return auditLogRepository.findRecentByUser(userId, pageable).stream()
                .map(AuditLogDto::fromEntity)
                .toList();
    }
}
