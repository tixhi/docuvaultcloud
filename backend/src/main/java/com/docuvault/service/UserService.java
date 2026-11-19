package com.docuvault.service;

import com.docuvault.dto.ChangePasswordRequest;
import com.docuvault.dto.UpdateProfileRequest;
import com.docuvault.dto.UserDto;
import com.docuvault.entity.User;
import com.docuvault.entity.UserRole;
import com.docuvault.exception.BadRequestException;
import com.docuvault.exception.ResourceNotFoundException;
import com.docuvault.exception.UnauthorizedException;
import com.docuvault.repository.FileRepository;
import com.docuvault.repository.UserRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final FileRepository fileRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService auditService;

    public UserService(UserRepository userRepository,
                       FileRepository fileRepository,
                       PasswordEncoder passwordEncoder,
                       AuditService auditService) {
        this.userRepository = userRepository;
        this.fileRepository = fileRepository;
        this.passwordEncoder = passwordEncoder;
        this.auditService = auditService;
    }

    @Transactional(readOnly = true)
    public UserDto getUserById(UUID id) {
        User user = userRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        return UserDto.fromEntity(user);
    }

    @Transactional
    public UserDto updateProfile(UUID userId, UpdateProfileRequest req, String ipAddress) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (req.fullName() != null && !req.fullName().isBlank()) {
            user.setFullName(req.fullName().trim());
        }
        if (req.avatarUrl() != null) {
            user.setAvatarUrl(req.avatarUrl().trim());
        }

        user = userRepository.save(user);
        auditService.log(user, "user.update_profile", "user", user.getId(), "{}", ipAddress);

        return UserDto.fromEntity(user);
    }

    @Transactional
    public void changePassword(UUID userId, ChangePasswordRequest req) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        if (!passwordEncoder.matches(req.currentPassword() != null ? req.currentPassword() : "", user.getPasswordHash())) {
            throw new UnauthorizedException("Current password is incorrect.");
        }

        user.setPasswordHash(passwordEncoder.encode(req.newPassword()));
        userRepository.save(user);
    }

    @Transactional(readOnly = true)
    public Map<String, Object> getStorageUsage(UUID userId) {
        Long usedBytes = fileRepository.calculateTotalStorageUsed(userId);
        Long fileCount = fileRepository.countActiveFiles(userId);

        Map<String, Object> usage = new HashMap<>();
        usage.put("used_bytes", usedBytes != null ? usedBytes : 0L);
        usage.put("file_count", fileCount != null ? fileCount : 0L);
        return usage;
    }

    @Transactional(readOnly = true)
    public List<UserDto> listUsers(String search, int limit, int offset) {
        int page = offset / Math.max(1, limit);
        Pageable pageable = PageRequest.of(page, Math.max(1, limit), Sort.by(Sort.Direction.DESC, "createdAt"));

        Page<User> users;
        if (search != null && !search.isBlank()) {
            users = userRepository.searchUsers(search.trim(), pageable);
        } else {
            users = userRepository.findAll(pageable);
        }

        return users.getContent().stream().map(UserDto::fromEntity).toList();
    }

    @Transactional
    public UserDto changeUserRole(UUID targetId, String roleStr, UUID actorId, String ipAddress) {
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        User actor = userRepository.findById(actorId).orElse(null);
        UserRole newRole = UserRole.fromString(roleStr);

        target.setRole(newRole);
        target = userRepository.save(target);

        auditService.log(actor, "user.role_changed", "user", target.getId(),
                "{\"role\":\"" + newRole.getValue() + "\"}", ipAddress);

        return UserDto.fromEntity(target);
    }

    @Transactional
    public UserDto setUserActive(UUID targetId, boolean isActive, UUID actorId, String ipAddress) {
        User target = userRepository.findById(targetId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

        User actor = userRepository.findById(actorId).orElse(null);

        target.setIsActive(isActive);
        target = userRepository.save(target);

        auditService.log(actor, "user.deactivated", "user", target.getId(),
                "{\"isActive\":" + isActive + "}", ipAddress);

        return UserDto.fromEntity(target);
    }
}
