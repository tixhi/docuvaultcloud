package com.docuvault.controller;

import com.docuvault.dto.ApiResponse;
import com.docuvault.dto.CreateShareRequest;
import com.docuvault.dto.ShareDto;
import com.docuvault.dto.UpdatePermissionRequest;
import com.docuvault.entity.User;
import com.docuvault.exception.UnauthorizedException;
import com.docuvault.repository.UserRepository;
import com.docuvault.security.UserPrincipal;
import com.docuvault.service.ShareService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/shares")
public class ShareController {

    private final ShareService shareService;
    private final UserRepository userRepository;

    public ShareController(ShareService shareService, UserRepository userRepository) {
        this.shareService = shareService;
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

    @GetMapping("/public/{token}")
    public ResponseEntity<Map<String, Object>> resolvePublicLink(@PathVariable("token") String token) {
        return ResponseEntity.ok(shareService.resolvePublicLink(token));
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> createShare(
            @RequestBody CreateShareRequest req,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest request
    ) {
        User user = getAuthenticatedUser(principal);
        ShareDto share = shareService.createShare(req, user, getClientIp(request));
        Map<String, Object> resp = new HashMap<>();
        resp.put("share", share);
        return ResponseEntity.status(HttpStatus.CREATED).body(resp);
    }

    @GetMapping("/with-me")
    public ResponseEntity<Map<String, Object>> sharedWithMe(@AuthenticationPrincipal UserPrincipal principal) {
        User user = getAuthenticatedUser(principal);
        List<ShareDto> list = shareService.getSharedWithMe(user);
        Map<String, Object> resp = new HashMap<>();
        resp.put("shares", list);
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/by-me")
    public ResponseEntity<Map<String, Object>> sharedByMe(@AuthenticationPrincipal UserPrincipal principal) {
        User user = getAuthenticatedUser(principal);
        List<ShareDto> list = shareService.getSharedByMe(user);
        Map<String, Object> resp = new HashMap<>();
        resp.put("shares", list);
        return ResponseEntity.ok(resp);
    }

    @PatchMapping("/{id}/permission")
    public ResponseEntity<Map<String, Object>> updatePermission(
            @PathVariable("id") UUID id,
            @Valid @RequestBody UpdatePermissionRequest req,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest request
    ) {
        User user = getAuthenticatedUser(principal);
        ShareDto updated = shareService.updatePermission(id, req.permission(), user, getClientIp(request));
        Map<String, Object> resp = new HashMap<>();
        resp.put("share", updated);
        return ResponseEntity.ok(resp);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse> revoke(
            @PathVariable("id") UUID id,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest request
    ) {
        User user = getAuthenticatedUser(principal);
        shareService.revokeShare(id, user, getClientIp(request));
        return ResponseEntity.ok(ApiResponse.success("Share revoked."));
    }
}
