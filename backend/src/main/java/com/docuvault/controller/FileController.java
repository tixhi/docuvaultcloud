package com.docuvault.controller;

import com.docuvault.dto.*;
import com.docuvault.entity.FileRecord;
import com.docuvault.entity.SharePermission;
import com.docuvault.entity.User;
import com.docuvault.exception.UnauthorizedException;
import com.docuvault.repository.UserRepository;
import com.docuvault.security.UserPrincipal;
import com.docuvault.service.FileService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.core.io.InputStreamResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/files")
public class FileController {

    private final FileService fileService;
    private final UserRepository userRepository;

    public FileController(FileService fileService, UserRepository userRepository) {
        this.fileService = fileService;
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

    @GetMapping("/usage")
    public ResponseEntity<UsageSummaryDto> usageSummary(@AuthenticationPrincipal UserPrincipal principal) {
        User user = getAuthenticatedUser(principal);
        return ResponseEntity.ok(fileService.getUsageSummary(user));
    }

    @GetMapping("/trash")
    public ResponseEntity<Map<String, Object>> listTrash(@AuthenticationPrincipal UserPrincipal principal) {
        User user = getAuthenticatedUser(principal);
        List<FileDto> trashedFiles = fileService.listTrash(user);
        Map<String, Object> resp = new HashMap<>();
        resp.put("files", trashedFiles);
        return ResponseEntity.ok(resp);
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, Object>> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "folderId", required = false) UUID folderId,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest request
    ) {
        User user = getAuthenticatedUser(principal);
        FileDto fileDto = fileService.upload(file, folderId, user, getClientIp(request));
        Map<String, Object> resp = new HashMap<>();
        resp.put("file", fileDto);
        return ResponseEntity.status(HttpStatus.CREATED).body(resp);
    }

    @PostMapping("/presign-upload")
    public ResponseEntity<PresignedUploadResponse> presignUpload(
            @Valid @RequestBody PresignUploadRequest req,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        User user = getAuthenticatedUser(principal);
        return ResponseEntity.ok(fileService.presignUpload(req, user));
    }

    @PostMapping("/complete-upload")
    public ResponseEntity<Map<String, Object>> completeUpload(
            @Valid @RequestBody CompleteUploadRequest req,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest request
    ) {
        User user = getAuthenticatedUser(principal);
        FileDto fileDto = fileService.completeUpload(req, user, getClientIp(request));
        Map<String, Object> resp = new HashMap<>();
        resp.put("file", fileDto);
        return ResponseEntity.status(HttpStatus.CREATED).body(resp);
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(value = "folderId", required = false) UUID folderId,
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "mimeCategory", required = false) String mimeCategory,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "limit", defaultValue = "100") int limit,
            @RequestParam(value = "sort", defaultValue = "created_at") String sort,
            @RequestParam(value = "dir", defaultValue = "DESC") String dir,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        User user = getAuthenticatedUser(principal);
        var filesPage = fileService.listFiles(folderId, search, mimeCategory, page, limit, sort, dir, user);
        Map<String, Object> resp = new HashMap<>();
        resp.put("files", filesPage.getContent());
        resp.put("total", filesPage.getTotalElements());
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/{id}")
    public ResponseEntity<Map<String, Object>> getOne(
            @PathVariable("id") UUID id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        User user = getAuthenticatedUser(principal);
        FileRecord record = fileService.loadAuthorizedFile(id, user, SharePermission.VIEW);
        Map<String, Object> resp = new HashMap<>();
        resp.put("file", FileDto.fromEntity(record));
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/{id}/download")
    public ResponseEntity<?> download(
            @PathVariable("id") UUID id,
            @RequestParam(value = "download", defaultValue = "false") boolean download,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest request
    ) {
        User user = getAuthenticatedUser(principal);
        var result = fileService.prepareDownload(id, download, user, getClientIp(request));

        if (result.redirectUrl() != null) {
            return ResponseEntity.status(HttpStatus.FOUND)
                    .location(URI.create(result.redirectUrl()))
                    .build();
        }

        String dispositionType = download ? "attachment" : "inline";
        String encodedFilename = URLEncoder.encode(result.filename(), StandardCharsets.UTF_8).replace("+", "%20");
        String disposition = dispositionType + "; filename=\"" + encodedFilename + "\"";

        Resource resource = new InputStreamResource(result.inputStream());
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(result.mimeType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                .body(resource);
    }

    @PatchMapping("/{id}/rename")
    public ResponseEntity<Map<String, Object>> rename(
            @PathVariable("id") UUID id,
            @Valid @RequestBody RenameRequest req,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest request
    ) {
        User user = getAuthenticatedUser(principal);
        FileDto updated = fileService.renameFile(id, req.name(), user, getClientIp(request));
        Map<String, Object> resp = new HashMap<>();
        resp.put("file", updated);
        return ResponseEntity.ok(resp);
    }

    @PatchMapping("/{id}/move")
    public ResponseEntity<Map<String, Object>> move(
            @PathVariable("id") UUID id,
            @RequestBody MoveRequest req,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest request
    ) {
        User user = getAuthenticatedUser(principal);
        FileDto updated = fileService.moveFile(id, req.folderId(), user, getClientIp(request));
        Map<String, Object> resp = new HashMap<>();
        resp.put("file", updated);
        return ResponseEntity.ok(resp);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> trash(
            @PathVariable("id") UUID id,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest request
    ) {
        User user = getAuthenticatedUser(principal);
        fileService.trashFile(id, user, getClientIp(request));
        return ResponseEntity.ok(ApiResponse.success("File moved to trash."));
    }

    @PostMapping("/{id}/restore")
    public ResponseEntity<ApiResponse> restore(
            @PathVariable("id") UUID id,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest request
    ) {
        User user = getAuthenticatedUser(principal);
        fileService.restoreFile(id, user, getClientIp(request));
        return ResponseEntity.ok(ApiResponse.success("File restored."));
    }

    @DeleteMapping("/{id}/permanent")
    public ResponseEntity<ApiResponse> permanentlyDelete(
            @PathVariable("id") UUID id,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        User user = getAuthenticatedUser(principal);
        fileService.permanentlyDelete(id, user);
        return ResponseEntity.ok(ApiResponse.success("File permanently deleted."));
    }
}
