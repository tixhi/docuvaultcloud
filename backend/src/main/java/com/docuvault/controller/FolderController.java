package com.docuvault.controller;

import com.docuvault.dto.ApiResponse;
import com.docuvault.dto.CreateFolderRequest;
import com.docuvault.dto.FolderContentsDto;
import com.docuvault.dto.FolderDto;
import com.docuvault.dto.RenameRequest;
import com.docuvault.entity.User;
import com.docuvault.exception.UnauthorizedException;
import com.docuvault.repository.UserRepository;
import com.docuvault.security.UserPrincipal;
import com.docuvault.service.FolderService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/folders")
public class FolderController {

    private final FolderService folderService;
    private final UserRepository userRepository;

    public FolderController(FolderService folderService, UserRepository userRepository) {
        this.folderService = folderService;
        this.userRepository = userRepository;
    }

    private User getAuthenticatedUser(UserPrincipal principal) {
        if (principal == null) throw new UnauthorizedException("User not authenticated");
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new UnauthorizedException("User not found"));
    }

    private String getClientIp(HttpServletRequest request) {
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    @GetMapping("/contents")
    public ResponseEntity<FolderContentsDto> contents(
            @RequestParam(value = "folderId", required = false) String folderIdStr,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        User user = getAuthenticatedUser(principal);
        UUID folderId = null;
        if (folderIdStr != null && !folderIdStr.isBlank() && !"root".equalsIgnoreCase(folderIdStr)) {
            folderId = UUID.fromString(folderIdStr);
        }
        return ResponseEntity.ok(folderService.getContents(folderId, user));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> create(
            @Valid @RequestBody CreateFolderRequest req,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest request
    ) {
        User user = getAuthenticatedUser(principal);
        FolderDto folder = folderService.createFolder(req.name(), req.parentId(), user, getClientIp(request));
        Map<String, Object> resp = new HashMap<>();
        resp.put("folder", folder);
        return ResponseEntity.status(HttpStatus.CREATED).body(resp);
    }

    @PatchMapping("/{id}/rename")
    public ResponseEntity<Map<String, Object>> rename(
            @PathVariable("id") UUID id,
            @Valid @RequestBody RenameRequest req,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest request
    ) {
        User user = getAuthenticatedUser(principal);
        FolderDto folder = folderService.renameFolder(id, req.name(), user, getClientIp(request));
        Map<String, Object> resp = new HashMap<>();
        resp.put("folder", folder);
        return ResponseEntity.ok(resp);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> remove(
            @PathVariable("id") UUID id,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest request
    ) {
        User user = getAuthenticatedUser(principal);
        folderService.deleteFolder(id, user, getClientIp(request));
        return ResponseEntity.ok(ApiResponse.success("Folder deleted."));
    }
}
