package com.docuvault.repository;

import com.docuvault.entity.Folder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface FolderRepository extends JpaRepository<Folder, UUID> {

    @Query("SELECT f FROM Folder f WHERE f.owner.id = :ownerId AND f.parent.id = :parentId AND f.isTrashed = false ORDER BY f.name ASC")
    List<Folder> findChildren(@Param("ownerId") UUID ownerId, @Param("parentId") UUID parentId);

    @Query("SELECT f FROM Folder f WHERE f.owner.id = :ownerId AND f.parent IS NULL AND f.isTrashed = false ORDER BY f.name ASC")
    List<Folder> findRootFolders(@Param("ownerId") UUID ownerId);

    Optional<Folder> findByIdAndOwnerIdAndIsTrashedFalse(UUID id, UUID ownerId);

    Optional<Folder> findByIdAndIsTrashedFalse(UUID id);

    boolean existsByOwnerIdAndParentIdAndNameIgnoreCaseAndIsTrashedFalse(UUID ownerId, UUID parentId, String name);

    boolean existsByOwnerIdAndParentIsNullAndNameIgnoreCaseAndIsTrashedFalse(UUID ownerId, String name);
}
