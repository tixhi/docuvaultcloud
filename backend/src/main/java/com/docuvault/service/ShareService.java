package com.docuvault.service;

import com.docuvault.dto.CreateShareRequest;
import com.docuvault.dto.FileDto;
import com.docuvault.dto.ShareDto;
import com.docuvault.entity.*;
import com.docuvault.exception.BadRequestException;
import com.docuvault.exception.ForbiddenException;
import com.docuvault.exception.ResourceNotFoundException;
import com.docuvault.repository.FileRepository;
import com.docuvault.repository.FolderRepository;
import com.docuvault.repository.ShareRepository;
import com.docuvault.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.*;

@Service
public class ShareService {

    private final ShareRepository shareRepository;
    private final FileRepository fileRepository;
    private final FolderRepository folderRepository;
    private final UserRepository userRepository;
    private final AuditService auditService;
    private final SecureRandom secureRandom = new SecureRandom();

    public ShareService(ShareRepository shareRepository,
                        FileRepository fileRepository,
                        FolderRepository folderRepository,
                        UserRepository userRepository,
                        AuditService auditService) {
        this.shareRepository = shareRepository;
        this.fileRepository = fileRepository;
        this.folderRepository = folderRepository;
        this.userRepository = userRepository;
        this.auditService = auditService;
    }

    @Transactional
    public ShareDto createShare(CreateShareRequest req, User currentUser, String ipAddress) {
        FileRecord file = null;
        if (req.fileId() != null) {
            file = fileRepository.findByIdAndIsTrashedFalse(req.fileId())
                    .orElseThrow(() -> new ResourceNotFoundException("File not found."));

            if (!file.getOwner().getId().equals(currentUser.getId()) &&
                    !UserRole.ADMIN.equals(currentUser.getRole())) {
                throw new ForbiddenException("Only the owner can share this file.");
            }
        }

        Folder folder = null;
        if (req.folderId() != null) {
            folder = folderRepository.findByIdAndIsTrashedFalse(req.folderId())
                    .orElseThrow(() -> new ResourceNotFoundException("Folder not found."));

            if (!folder.getOwner().getId().equals(currentUser.getId()) &&
                    !UserRole.ADMIN.equals(currentUser.getRole())) {
                throw new ForbiddenException("Only the owner can share this folder.");
            }
        }

        if (file == null && folder == null) {
            throw new BadRequestException("Either fileId or folderId must be specified.");
        }

        SharePermission perm = SharePermission.fromString(req.permission());

        if (Boolean.TRUE.equals(req.publicLink())) {
            byte[] bytes = new byte[24];
            secureRandom.nextBytes(bytes);
            String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

            Share share = new Share(file, folder, currentUser, null, perm, token, req.expiresAt());
            share = shareRepository.save(share);

            auditService.log(currentUser, "share.create", file != null ? "file" : "folder",
                    file != null ? file.getId() : folder.getId(),
                    "{\"type\":\"public_link\",\"permission\":\"" + perm.getValue() + "\"}", ipAddress);

            return ShareDto.fromEntity(share);
        }

        if (req.email() == null || req.email().isBlank()) {
            throw new BadRequestException("An email address is required to share with a user.");
        }

        String targetEmail = req.email().trim().toLowerCase();
        User targetUser = userRepository.findByEmailIgnoreCase(targetEmail)
                .orElseThrow(() -> new ResourceNotFoundException("No user found with that email."));

        if (targetUser.getId().equals(currentUser.getId())) {
            throw new BadRequestException("You cannot share a file with yourself.");
        }

        Share share = new Share(file, folder, currentUser, targetUser, perm, null, req.expiresAt());
        share = shareRepository.save(share);

        auditService.log(currentUser, "share.create", file != null ? "file" : "folder",
                file != null ? file.getId() : folder.getId(),
                "{\"sharedWith\":\"" + targetUser.getEmail() + "\",\"permission\":\"" + perm.getValue() + "\"}", ipAddress);

        return ShareDto.fromEntity(share);
    }

    @Transactional(readOnly = true)
    public List<ShareDto> getSharedWithMe(User currentUser) {
        return shareRepository.findSharedWithUser(currentUser.getId(), Instant.now())
                .stream()
                .map(ShareDto::fromEntity)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ShareDto> getSharedByMe(User currentUser) {
        return shareRepository.findSharedByUser(currentUser.getId())
                .stream()
                .map(ShareDto::fromEntity)
                .toList();
    }

    @Transactional
    public ShareDto updatePermission(UUID shareId, String newPermission, User currentUser, String ipAddress) {
        Share share = shareRepository.findById(shareId)
                .orElseThrow(() -> new ResourceNotFoundException("Share not found."));

        if (!share.getSharedBy().getId().equals(currentUser.getId()) &&
                !UserRole.ADMIN.equals(currentUser.getRole())) {
            throw new ForbiddenException("Only the sharer can change permissions.");
        }

        SharePermission perm = SharePermission.fromString(newPermission);
        share.setPermission(perm);
        share = shareRepository.save(share);

        auditService.log(currentUser, "share.permission_change", "share", share.getId(),
                "{\"permission\":\"" + perm.getValue() + "\"}", ipAddress);

        return ShareDto.fromEntity(share);
    }

    @Transactional
    public void revokeShare(UUID shareId, User currentUser, String ipAddress) {
        Share share = shareRepository.findById(shareId)
                .orElseThrow(() -> new ResourceNotFoundException("Share not found."));

        if (!share.getSharedBy().getId().equals(currentUser.getId()) &&
                !UserRole.ADMIN.equals(currentUser.getRole())) {
            throw new ForbiddenException("Only the sharer can revoke this share.");
        }

        shareRepository.delete(share);

        auditService.log(currentUser, "share.revoke", "share", share.getId(), "{}", ipAddress);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> resolvePublicLink(String token) {
        Share share = shareRepository.findValidByPublicToken(token, Instant.now())
                .orElseThrow(() -> new ResourceNotFoundException("This link is invalid or has expired."));

        if (share.getFile() == null || Boolean.TRUE.equals(share.getFile().getIsTrashed())) {
            throw new ResourceNotFoundException("The shared file no longer exists.");
        }

        Map<String, Object> result = new HashMap<>();
        result.put("file", FileDto.fromEntity(share.getFile()));
        result.put("permission", share.getPermission().getValue());
        return result;
    }
}
