package com.docuvault.service;

import com.docuvault.dto.BreadcrumbDto;
import com.docuvault.dto.FileDto;
import com.docuvault.dto.FolderContentsDto;
import com.docuvault.dto.FolderDto;
import com.docuvault.entity.FileRecord;
import com.docuvault.entity.Folder;
import com.docuvault.entity.User;
import com.docuvault.exception.BadRequestException;
import com.docuvault.exception.ForbiddenException;
import com.docuvault.exception.ResourceNotFoundException;
import com.docuvault.repository.FileRepository;
import com.docuvault.repository.FolderRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

@Service
public class FolderService {

    private final FolderRepository folderRepository;
    private final FileRepository fileRepository;
    private final AuditService auditService;

    public FolderService(FolderRepository folderRepository,
                         FileRepository fileRepository,
                         AuditService auditService) {
        this.folderRepository = folderRepository;
        this.fileRepository = fileRepository;
        this.auditService = auditService;
    }

    @Transactional
    public FolderDto createFolder(String name, UUID parentId, User owner, String ipAddress) {
        String cleanName = name.trim();
        Folder parent = null;
        if (parentId != null) {
            parent = folderRepository.findById(parentId)
                    .orElseThrow(() -> new BadRequestException("Parent folder not found."));
            if (!parent.getOwner().getId().equals(owner.getId())) {
                throw new BadRequestException("Parent folder not found.");
            }
        }

        Folder folder = new Folder(cleanName, owner, parent);
        folder = folderRepository.save(folder);

        auditService.log(owner, "folder.create", "folder", folder.getId(),
                "{\"name\":\"" + folder.getName() + "\"}", ipAddress);

        return FolderDto.fromEntity(folder);
    }

    @Transactional(readOnly = true)
    public FolderContentsDto getContents(UUID folderId, User owner) {
        List<Folder> folders;
        List<BreadcrumbDto> breadcrumbs = new ArrayList<>();

        if (folderId != null) {
            Folder folder = folderRepository.findByIdAndIsTrashedFalse(folderId)
                    .orElseThrow(() -> new ResourceNotFoundException("Folder not found."));
            if (!folder.getOwner().getId().equals(owner.getId())) {
                throw new ForbiddenException("You do not have access to this folder.");
            }

            folders = folderRepository.findChildren(owner.getId(), folderId);
            breadcrumbs = buildBreadcrumbs(folder);
        } else {
            folders = folderRepository.findRootFolders(owner.getId());
        }

        Page<FileRecord> filesPage = fileRepository.listFiles(
                owner.getId(),
                folderId,
                null,
                null,
                PageRequest.of(0, 500, Sort.by(Sort.Direction.ASC, "originalName"))
        );

        List<FolderDto> folderDtos = folders.stream().map(FolderDto::fromEntity).toList();
        List<FileDto> fileDtos = filesPage.getContent().stream().map(FileDto::fromEntity).toList();

        return new FolderContentsDto(folderDtos, fileDtos, breadcrumbs);
    }

    @Transactional
    public FolderDto renameFolder(UUID folderId, String newName, User currentUser, String ipAddress) {
        Folder folder = folderRepository.findById(folderId)
                .orElseThrow(() -> new ResourceNotFoundException("Folder not found."));

        if (!folder.getOwner().getId().equals(currentUser.getId()) &&
                !currentUser.getRole().getValue().equalsIgnoreCase("admin")) {
            throw new ForbiddenException("You do not have permission to rename this folder.");
        }

        String oldName = folder.getName();
        folder.setName(newName.trim());
        folder = folderRepository.save(folder);

        auditService.log(currentUser, "folder.rename", "folder", folder.getId(),
                "{\"from\":\"" + oldName + "\",\"to\":\"" + folder.getName() + "\"}", ipAddress);

        return FolderDto.fromEntity(folder);
    }

    @Transactional
    public void deleteFolder(UUID folderId, User currentUser, String ipAddress) {
        Folder folder = folderRepository.findById(folderId)
                .orElseThrow(() -> new ResourceNotFoundException("Folder not found."));

        if (!folder.getOwner().getId().equals(currentUser.getId()) &&
                !currentUser.getRole().getValue().equalsIgnoreCase("admin")) {
            throw new ForbiddenException("You do not have permission to delete this folder.");
        }

        folder.setIsTrashed(true);
        folderRepository.save(folder);

        auditService.log(currentUser, "folder.delete", "folder", folder.getId(),
                "{\"name\":\"" + folder.getName() + "\"}", ipAddress);
    }

    private List<BreadcrumbDto> buildBreadcrumbs(Folder current) {
        List<BreadcrumbDto> list = new ArrayList<>();
        Folder cur = current;
        while (cur != null) {
            list.add(new BreadcrumbDto(cur.getId(), cur.getName()));
            cur = cur.getParent();
        }
        Collections.reverse(list);
        return list;
    }
}
