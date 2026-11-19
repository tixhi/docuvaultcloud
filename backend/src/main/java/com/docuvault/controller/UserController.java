package com.docuvault.controller;

import com.docuvault.dto.*;
import com.docuvault.entity.User;
import com.docuvault.exception.UnauthorizedException;
import com.docuvault.repository.UserRepository;
import com.docuvault.security.UserPrincipal;
import com.docuvault.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/users")
public class UserController {

    private final UserService userService;
    private final UserRepository userRepository;

    public UserController(UserService userService, UserRepository userRepository) {
        this.userService = userService;
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

    @PatchMapping("/me")
    public ResponseEntity<Map<String, Object>> updateMyProfile(
            @RequestBody UpdateProfileRequest req,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest request
    ) {
        User user = getAuthenticatedUser(principal);
        UserDto updated = userService.updateProfile(user.getId(), req, getClientIp(request));
        Map<String, Object> resp = new HashMap<>();
        resp.put("user", updated);
        return ResponseEntity.ok(resp);
    }

    @PostMapping("/me/password")
    public ResponseEntity<ApiResponse> changeMyPassword(
            @Valid @RequestBody ChangePasswordRequest req,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        User user = getAuthenticatedUser(principal);
        userService.changePassword(user.getId(), req);
        return ResponseEntity.ok(ApiResponse.success("Password updated."));
    }

    @GetMapping("/me/usage")
    public ResponseEntity<Map<String, Object>> myUsage(@AuthenticationPrincipal UserPrincipal principal) {
        User user = getAuthenticatedUser(principal);
        return ResponseEntity.ok(userService.getStorageUsage(user.getId()));
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Map<String, Object>> listUsers(
            @RequestParam(value = "search", required = false) String search,
            @RequestParam(value = "limit", defaultValue = "50") int limit,
            @RequestParam(value = "offset", defaultValue = "0") int offset
    ) {
        List<UserDto> users = userService.listUsers(search, limit, offset);
        Map<String, Object> resp = new HashMap<>();
        resp.put("users", users);
        return ResponseEntity.ok(resp);
    }

    @PatchMapping("/{id}/role")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> changeUserRole(
            @PathVariable("id") UUID id,
            @Valid @RequestBody UpdateRoleRequest req,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest request
    ) {
        User user = getAuthenticatedUser(principal);
        UserDto updated = userService.changeUserRole(id, req.role(), user.getId(), getClientIp(request));
        Map<String, Object> resp = new HashMap<>();
        resp.put("user", updated);
        return ResponseEntity.ok(resp);
    }

    @PatchMapping("/{id}/active")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> setUserActive(
            @PathVariable("id") UUID id,
            @Valid @RequestBody UpdateActiveRequest req,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest request
    ) {
        User user = getAuthenticatedUser(principal);
        UserDto updated = userService.setUserActive(id, req.isActive(), user.getId(), getClientIp(request));
        Map<String, Object> resp = new HashMap<>();
        resp.put("user", updated);
        return ResponseEntity.ok(resp);
    }
}
