package com.docuvault.controller;

import com.docuvault.dto.AuditLogDto;
import com.docuvault.entity.User;
import com.docuvault.entity.UserRole;
import com.docuvault.exception.UnauthorizedException;
import com.docuvault.repository.UserRepository;
import com.docuvault.security.UserPrincipal;
import com.docuvault.service.AuditService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/audit")
public class AuditController {

    private final AuditService auditService;
    private final UserRepository userRepository;

    public AuditController(AuditService auditService, UserRepository userRepository) {
        this.auditService = auditService;
        this.userRepository = userRepository;
    }

    private User getAuthenticatedUser(UserPrincipal principal) {
        if (principal == null) throw new UnauthorizedException("User not authenticated");
        return userRepository.findById(principal.getId())
                .orElseThrow(() -> new UnauthorizedException("User not found"));
    }

    @GetMapping
    public ResponseEntity<Map<String, Object>> list(
            @RequestParam(value = "userId", required = false) UUID requestedUserId,
            @RequestParam(value = "action", required = false) String action,
            @RequestParam(value = "from", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant from,
            @RequestParam(value = "to", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant to,
            @RequestParam(value = "limit", defaultValue = "100") int limit,
            @RequestParam(value = "offset", defaultValue = "0") int offset,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        User user = getAuthenticatedUser(principal);
        boolean canSeeAll = UserRole.ADMIN.equals(user.getRole()) || UserRole.MANAGER.equals(user.getRole());
        UUID actorId = canSeeAll ? requestedUserId : user.getId();

        List<AuditLogDto> logs = auditService.list(actorId, action, from, to, limit, offset);
        Map<String, Object> resp = new HashMap<>();
        resp.put("logs", logs);
        return ResponseEntity.ok(resp);
    }

    @GetMapping("/mine")
    public ResponseEntity<Map<String, Object>> myActivity(
            @RequestParam(value = "limit", defaultValue = "50") int limit,
            @AuthenticationPrincipal UserPrincipal principal
    ) {
        User user = getAuthenticatedUser(principal);
        List<AuditLogDto> logs = auditService.getUserActivity(user.getId(), limit);
        Map<String, Object> resp = new HashMap<>();
        resp.put("logs", logs);
        return ResponseEntity.ok(resp);
    }
}
