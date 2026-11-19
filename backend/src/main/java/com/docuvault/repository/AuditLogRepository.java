package com.docuvault.repository;

import com.docuvault.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    @Query("SELECT a FROM AuditLog a LEFT JOIN FETCH a.actor u " +
           "WHERE (:actorId IS NULL OR a.actor.id = :actorId) " +
           "AND (:action IS NULL OR a.action = :action) " +
           "AND (:from IS NULL OR a.createdAt >= :from) " +
           "AND (:to IS NULL OR a.createdAt <= :to)")
    Page<AuditLog> filterLogs(
            @Param("actorId") UUID actorId,
            @Param("action") String action,
            @Param("from") Instant from,
            @Param("to") Instant to,
            Pageable pageable
    );

    @Query("SELECT a FROM AuditLog a WHERE a.actor.id = :userId ORDER BY a.createdAt DESC")
    List<AuditLog> findRecentByUser(@Param("userId") UUID userId, Pageable pageable);
}
