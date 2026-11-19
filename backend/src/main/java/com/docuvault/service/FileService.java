package com.docuvault.service;

import com.docuvault.dto.*;
import com.docuvault.entity.*;
import com.docuvault.exception.*;
import com.docuvault.repository.FileRepository;
import com.docuvault.repository.FolderRepository;
import com.docuvault.repository.ShareRepository;
import com.docuvault.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.time.Instant;
import java.util.*;

@Service
public class FileService {

    private final FileRepository fileRepository;
    private final FolderRepository folderRepository;
    private final ShareRepository shareRepository;
    private final UserRepository userRepository;
    private final StorageService storageService;
    private final AuditService auditService;

    public FileService(FileRepository fileRepository,
                       FolderRepository folderRepository,
                       ShareRepository shareRepository,
                       UserRepository userRepository,
                       StorageService storageService,
                       AuditService auditService) {
        this.fileRepository = fileRepository;
        this.folderRepository = folderRepository;
        this.shareRepository = shareRepository;
        this.userRepository = userRepository;
        this.storageService = storageService;
        this.auditService = auditService;
    }

    public FileRecord loadAuthorizedFile(UUID fileId, User currentUser, SharePermission minPermission) {
        FileRecord file = fileRepository.findByIdAndIsTrashedFalse(fileId)
                .orElseThrow(() -> new ResourceNotFoundException("File not found."));

        if (file.getOwner().getId().equals(currentUser.getId()) ||
                UserRole.ADMIN.equals(currentUser.getRole())) {
            return file;
        }

        Optional<Share> shareOpt = shareRepository.findActiveAccessForFile(fileId, currentUser.getId(), Instant.now());
        if (shareOpt.isPresent()) {
            Share share = shareOpt.get();
            int requiredRank = minPermission != null ? minPermission.ordinal() : 0;
            int actualRank = share.getPermission() != null ? share.getPermission().ordinal() : 0;
            if (actualRank >= requiredRank) {
                return file;
            }
        }

        throw new ForbiddenException("You do not have access to this file.");
    }

    @Transactional
    public FileDto upload(MultipartFile file, UUID folderId, User currentUser, String ipAddress) {
        if (file.isEmpty()) {
            throw new BadRequestException("No file was provided.");
        }

        long usedBytes = Optional.ofNullable(fileRepository.calculateTotalStorageUsed(currentUser.getId())).orElse(0L);
        long quotaBytes = (long) currentUser.getStorageQuotaMb() * 1024 * 1024;
        if (usedBytes + file.getSize() > quotaBytes) {
            throw new QuotaExceededException("This upload would exceed your storage quota.");
        }

        Folder folder = null;
        if (folderId != null) {
            folder = folderRepository.findByIdAndOwnerIdAndIsTrashedFalse(folderId, currentUser.getId())
                    .orElseThrow(() -> new BadRequestException("Target folder not found."));
        }

        String originalName = file.getOriginalFilename() != null ? file.getOriginalFilename() : "document";
        String ext = "";
        int lastDot = originalName.lastIndexOf('.');
        if (lastDot > 0 && lastDot < originalName.length() - 1) {
            ext = originalName.substring(lastDot + 1);
        }

        try {
            byte[] bytes = file.getBytes();
            String key = storageService.buildKey(currentUser.getId(), ext);
            storageService.put(bytes, key, file.getContentType());
            String checksum = storageService.calculateChecksum(bytes);

            FileRecord record = new FileRecord(
                    originalName,
                    file.getContentType() != null ? file.getContentType() : "application/octet-stream",
                    file.getSize(),
                    key,
                    storageService.getDriverName(),
                    checksum,
                    currentUser,
                    folder
            );
            record = fileRepository.save(record);

            auditService.log(currentUser, "file.upload", "file", record.getId(),
                    "{\"name\":\"" + record.getOriginalName() + "\",\"size\":" + record.getSizeBytes() + "}", ipAddress);

            return FileDto.fromEntity(record);
        } catch (IOException e) {
            throw new AppException("Failed to read uploaded file: " + e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public PresignedUploadResponse presignUpload(PresignUploadRequest req, User currentUser) {
        if (!"s3".equalsIgnoreCase(storageService.getDriverName())) {
            throw new BadRequestException("Direct upload is only available with STORAGE_DRIVER=s3.");
        }

        String ext = "";
        int lastDot = req.fileName().lastIndexOf('.');
        if (lastDot > 0 && lastDot < req.fileName().length() - 1) {
            ext = req.fileName().substring(lastDot + 1);
        }

        String key = storageService.buildKey(currentUser.getId(), ext);
        String uploadUrl = storageService.getUploadUrl(key, req.mimeType());

        return new PresignedUploadResponse(uploadUrl, key, req.folderId());
    }

    @Transactional
    public FileDto completeUpload(CompleteUploadRequest req, User currentUser, String ipAddress) {
        if (storageService.getDriverName().equalsIgnoreCase("s3")) {
            if (!storageService.exists(req.key())) {
                throw new BadRequestException("Upload not found in storage -- did the direct upload complete?");
            }
        }

        Folder folder = null;
        if (req.folderId() != null) {
            folder = folderRepository.findByIdAndOwnerIdAndIsTrashedFalse(req.folderId(), currentUser.getId())
                    .orElse(null);
        }

        FileRecord record = new FileRecord(
                req.fileName(),
                req.mimeType(),
                req.sizeBytes(),
                req.key(),
                storageService.getDriverName(),
                null,
                currentUser,
                folder
        );
        record = fileRepository.save(record);

        auditService.log(currentUser, "file.upload", "file", record.getId(),
                "{\"name\":\"" + record.getOriginalName() + "\",\"size\":" + record.getSizeBytes() + "}", ipAddress);

        return FileDto.fromEntity(record);
    }

    @Transactional(readOnly = true)
    public Page<FileDto> listFiles(UUID folderId, String search, String mimeCategory,
                                  int page, int size, String sort, String dir, User currentUser) {
        Sort.Direction direction = "ASC".equalsIgnoreCase(dir) ? Sort.Direction.ASC : Sort.Direction.DESC;
        String sortProperty = switch (sort != null ? sort.toLowerCase() : "") {
            case "original_name", "name" -> "originalName";
            case "size_bytes", "size" -> "sizeBytes";
            case "updated_at" -> "updatedAt";
            default -> "createdAt";
        };

        Pageable pageable = PageRequest.of(page, size, Sort.by(direction, sortProperty));
        return fileRepository.listFiles(currentUser.getId(), folderId, search, mimeCategory, pageable)
                .map(FileDto::fromEntity);
    }

    public record FileDownloadResult(String redirectUrl, InputStream inputStream, String filename, String mimeType) {}

    @Transactional(readOnly = true)
    public FileDownloadResult prepareDownload(UUID fileId, boolean forceDownload, User currentUser, String ipAddress) {
        FileRecord file = loadAuthorizedFile(fileId, currentUser, SharePermission.VIEW);

        auditService.log(currentUser, "file.download", "file", file.getId(), "{}", ipAddress);

        String presignedDownloadUrl = storageService.getDownloadUrl(file.getStorageKey(), file.getOriginalName(), forceDownload);
        if (presignedDownloadUrl != null) {
            return new FileDownloadResult(presignedDownloadUrl, null, file.getOriginalName(), file.getMimeType());
        }

        InputStream stream = storageService.getStream(file.getStorageKey());
        return new FileDownloadResult(null, stream, file.getOriginalName(), file.getMimeType());
    }

    @Transactional
    public FileDto renameFile(UUID fileId, String newName, User currentUser, String ipAddress) {
        FileRecord file = loadAuthorizedFile(fileId, currentUser, SharePermission.EDIT);
        String oldName = file.getOriginalName();
        file.setOriginalName(newName.trim());
        file = fileRepository.save(file);

        auditService.log(currentUser, "file.rename", "file", file.getId(),
                "{\"from\":\"" + oldName + "\",\"to\":\"" + file.getOriginalName() + "\"}", ipAddress);

        return FileDto.fromEntity(file);
    }

    @Transactional
    public FileDto moveFile(UUID fileId, UUID targetFolderId, User currentUser, String ipAddress) {
        FileRecord file = loadAuthorizedFile(fileId, currentUser, SharePermission.EDIT);

        Folder targetFolder = null;
        if (targetFolderId != null) {
            targetFolder = folderRepository.findByIdAndOwnerIdAndIsTrashedFalse(targetFolderId, file.getOwner().getId())
                    .orElseThrow(() -> new BadRequestException("Target folder not found."));
        }

        file.setFolder(targetFolder);
        file = fileRepository.save(file);

        auditService.log(currentUser, "file.move", "file", file.getId(),
                "{\"folderId\":" + (targetFolderId != null ? "\"" + targetFolderId + "\"" : "null") + "}", ipAddress);

        return FileDto.fromEntity(file);
    }

    @Transactional
    public void trashFile(UUID fileId, User currentUser, String ipAddress) {
        FileRecord file = loadAuthorizedFile(fileId, currentUser, SharePermission.EDIT);
        file.setIsTrashed(true);
        fileRepository.save(file);

        auditService.log(currentUser, "file.delete", "file", file.getId(), "{}", ipAddress);
    }

    @Transactional
    public void restoreFile(UUID fileId, User currentUser, String ipAddress) {
        FileRecord file = fileRepository.findByIdAndOwnerIdAndIsTrashedTrue(fileId, currentUser.getId())
                .orElseThrow(() -> new ResourceNotFoundException("File not found in trash."));

        file.setIsTrashed(false);
        fileRepository.save(file);

        auditService.log(currentUser, "file.restore", "file", file.getId(), "{}", ipAddress);
    }

    @Transactional(readOnly = true)
    public List<FileDto> listTrash(User currentUser) {
        return fileRepository.findByOwnerIdAndIsTrashedTrueOrderByUpdatedAtDesc(currentUser.getId())
                .stream()
                .map(FileDto::fromEntity)
                .toList();
    }

    @Transactional
    public void permanentlyDelete(UUID fileId, User currentUser) {
        FileRecord file = fileRepository.findByIdAndOwnerIdAndIsTrashedTrue(fileId, currentUser.getId())
                .orElseThrow(() -> new ResourceNotFoundException("File not found in trash."));

        storageService.delete(file.getStorageKey());
        fileRepository.delete(file);
    }

    @Transactional(readOnly = true)
    public UsageSummaryDto getUsageSummary(User currentUser) {
        Long usedBytes = Optional.ofNullable(fileRepository.calculateTotalStorageUsed(currentUser.getId())).orElse(0L);
        Long fileCount = Optional.ofNullable(fileRepository.countActiveFiles(currentUser.getId())).orElse(0L);

        List<FileDto> recent = fileRepository.findRecentFiles(currentUser.getId(), PageRequest.of(0, 8))
                .stream().map(FileDto::fromEntity).toList();

        List<CategoryUsageDto> categoryList = new ArrayList<>();
        try {
            List<Object[]> rows = fileRepository.getUsageByCategoryNative(currentUser.getId());
            for (Object[] r : rows) {
                String cat = (String) r[0];
                Long count = ((Number) r[1]).longValue();
                Long bytes = ((Number) r[2]).longValue();
                categoryList.add(new CategoryUsageDto(cat, count, bytes));
            }
        } catch (Exception e) {
            // fallback if native query differs in non-postgres test profiles
        }

        return new UsageSummaryDto(
                usedBytes,
                fileCount,
                currentUser.getStorageQuotaMb(),
                categoryList,
                recent
        );
    }
}
