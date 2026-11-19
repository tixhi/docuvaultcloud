package com.docuvault.repository;

import com.docuvault.entity.FileRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FileRepository extends JpaRepository<FileRecord, UUID> {

    Optional<FileRecord> findByIdAndIsTrashedFalse(UUID id);

    Optional<FileRecord> findByIdAndOwnerIdAndIsTrashedTrue(UUID id, UUID ownerId);

    List<FileRecord> findByOwnerIdAndIsTrashedTrueOrderByUpdatedAtDesc(UUID ownerId);

    @Query("SELECT f FROM FileRecord f WHERE f.owner.id = :ownerId AND f.isTrashed = false " +
           "AND (:folderId IS NULL AND f.folder IS NULL OR f.folder.id = :folderId) " +
           "AND (:search IS NULL OR LOWER(f.originalName) LIKE LOWER(CONCAT('%', :search, '%'))) " +
           "AND (:mimeCategory IS NULL OR LOWER(f.mimeType) LIKE LOWER(CONCAT(:mimeCategory, '%')))")
    Page<FileRecord> listFiles(
            @Param("ownerId") UUID ownerId,
            @Param("folderId") UUID folderId,
            @Param("search") String search,
            @Param("mimeCategory") String mimeCategory,
            Pageable pageable
    );

    @Query("SELECT f FROM FileRecord f WHERE f.owner.id = :ownerId AND f.isTrashed = false " +
           "AND (:search IS NULL OR LOWER(f.originalName) LIKE LOWER(CONCAT('%', :search, '%')))")
    Page<FileRecord> searchAllFiles(
            @Param("ownerId") UUID ownerId,
            @Param("search") String search,
            Pageable pageable
    );

    @Query("SELECT COALESCE(SUM(f.sizeBytes), 0) FROM FileRecord f WHERE f.owner.id = :ownerId AND f.isTrashed = false")
    Long calculateTotalStorageUsed(@Param("ownerId") UUID ownerId);

    @Query("SELECT COUNT(f) FROM FileRecord f WHERE f.owner.id = :ownerId AND f.isTrashed = false")
    Long countActiveFiles(@Param("ownerId") UUID ownerId);

    @Query("SELECT f FROM FileRecord f WHERE f.owner.id = :ownerId AND f.isTrashed = false ORDER BY f.updatedAt DESC")
    List<FileRecord> findRecentFiles(@Param("ownerId") UUID ownerId, Pageable pageable);

    @Query(value = "SELECT " +
            "CASE " +
            "  WHEN mime_type LIKE 'image/%' THEN 'images' " +
            "  WHEN mime_type = 'application/pdf' THEN 'pdf' " +
            "  WHEN mime_type LIKE 'video/%' THEN 'video' " +
            "  WHEN mime_type LIKE 'text/%' OR mime_type LIKE '%word%' OR mime_type LIKE '%document%' THEN 'documents' " +
            "  ELSE 'other' " +
            "END AS category, " +
            "COUNT(*)::int AS file_count, " +
            "COALESCE(SUM(size_bytes), 0)::bigint AS total_bytes " +
            "FROM files " +
            "WHERE owner_id = :ownerId AND is_trashed = false " +
            "GROUP BY category", nativeQuery = true)
    List<Object[]> getUsageByCategoryNative(@Param("ownerId") UUID ownerId);
}
