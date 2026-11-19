package com.docuvault.repository;

import com.docuvault.entity.Share;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ShareRepository extends JpaRepository<Share, UUID> {

    @Query("SELECT s FROM Share s LEFT JOIN FETCH s.file f LEFT JOIN FETCH s.sharedBy u " +
           "WHERE s.sharedWith.id = :userId AND (s.expiresAt IS NULL OR s.expiresAt > :now) " +
           "ORDER BY s.createdAt DESC")
    List<Share> findSharedWithUser(@Param("userId") UUID userId, @Param("now") Instant now);

    @Query("SELECT s FROM Share s LEFT JOIN FETCH s.file f LEFT JOIN FETCH s.sharedWith u " +
           "WHERE s.sharedBy.id = :userId ORDER BY s.createdAt DESC")
    List<Share> findSharedByUser(@Param("userId") UUID userId);

    @Query("SELECT s FROM Share s LEFT JOIN FETCH s.file f " +
           "WHERE s.publicToken = :token AND (s.expiresAt IS NULL OR s.expiresAt > :now)")
    Optional<Share> findValidByPublicToken(@Param("token") String token, @Param("now") Instant now);

    @Query("SELECT s FROM Share s WHERE s.file.id = :fileId AND s.sharedWith.id = :userId " +
           "AND (s.expiresAt IS NULL OR s.expiresAt > :now)")
    Optional<Share> findActiveAccessForFile(@Param("fileId") UUID fileId, @Param("userId") UUID userId, @Param("now") Instant now);
}
