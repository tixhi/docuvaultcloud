package com.docuvault.service;

import com.docuvault.dto.AuthResponse;
import com.docuvault.dto.LoginRequest;
import com.docuvault.dto.RegisterRequest;
import com.docuvault.dto.UserDto;
import com.docuvault.entity.RefreshToken;
import com.docuvault.entity.User;
import com.docuvault.entity.UserRole;
import com.docuvault.exception.BadRequestException;
import com.docuvault.exception.UnauthorizedException;
import com.docuvault.repository.RefreshTokenRepository;
import com.docuvault.repository.UserRepository;
import com.docuvault.security.JwtTokenProvider;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class AuthService {

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final AuditService auditService;

    public record AuthResult(AuthResponse authResponse, String rawRefreshToken) {}

    public AuthService(UserRepository userRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       PasswordEncoder passwordEncoder,
                       JwtTokenProvider tokenProvider,
                       AuditService auditService) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
        this.auditService = auditService;
    }

    @Transactional
    public AuthResult register(RegisterRequest req, String ipAddress) {
        String cleanEmail = req.email().trim().toLowerCase();
        if (userRepository.existsByEmailIgnoreCase(cleanEmail)) {
            throw new BadRequestException("An account with this email already exists.");
        }

        String encodedPassword = passwordEncoder.encode(req.password());
        User user = new User(req.fullName().trim(), cleanEmail, encodedPassword, UserRole.MEMBER);
        user = userRepository.save(user);

        auditService.log(user, "user.register", "user", user.getId(), "{}", ipAddress);

        return issueSession(user);
    }

    @Transactional
    public AuthResult login(LoginRequest req, String ipAddress) {
        String cleanEmail = req.email().trim().toLowerCase();
        User user = userRepository.findByEmailIgnoreCase(cleanEmail)
                .orElse(null);

        if (user == null || !Boolean.TRUE.equals(user.getIsActive())) {
            auditService.log(null, "user.login_failed", "user", null, "{\"email\":\"" + cleanEmail + "\"}", ipAddress);
            throw new UnauthorizedException("Invalid email or password.");
        }

        if (!passwordEncoder.matches(req.password(), user.getPasswordHash())) {
            auditService.log(user, "user.login_failed", "user", user.getId(), "{}", ipAddress);
            throw new UnauthorizedException("Invalid email or password.");
        }

        user.setLastLoginAt(Instant.now());
        userRepository.save(user);

        auditService.log(user, "user.login", "user", user.getId(), "{}", ipAddress);

        return issueSession(user);
    }

    @Transactional
    public AuthResponse refresh(String rawRefreshToken) {
        if (rawRefreshToken == null || rawRefreshToken.isBlank() || !tokenProvider.validateRefreshToken(rawRefreshToken)) {
            throw new UnauthorizedException("Refresh token is invalid or expired.");
        }

        String tokenHash = tokenProvider.hashToken(rawRefreshToken);
        RefreshToken refreshToken = refreshTokenRepository
                .findByTokenHashAndRevokedFalseAndExpiresAtAfter(tokenHash, Instant.now())
                .orElseThrow(() -> new UnauthorizedException("Refresh token has been revoked or expired."));

        User user = refreshToken.getUser();
        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new UnauthorizedException("Account is not active.");
        }

        String newAccessToken = tokenProvider.generateAccessToken(user);
        return new AuthResponse(UserDto.fromEntity(user), newAccessToken);
    }

    @Transactional
    public void logout(String rawRefreshToken, UUID currentUserId, String ipAddress) {
        if (rawRefreshToken != null && !rawRefreshToken.isBlank()) {
            String tokenHash = tokenProvider.hashToken(rawRefreshToken);
            refreshTokenRepository.revokeByTokenHash(tokenHash);
        }

        if (currentUserId != null) {
            userRepository.findById(currentUserId).ifPresent(user ->
                    auditService.log(user, "user.logout", "user", user.getId(), "{}", ipAddress));
        }
    }

    private AuthResult issueSession(User user) {
        String accessToken = tokenProvider.generateAccessToken(user);
        String refreshToken = tokenProvider.generateRefreshToken(user);

        String tokenHash = tokenProvider.hashToken(refreshToken);
        Instant expiresAt = Instant.now().plusMillis(tokenProvider.getRefreshExpirationMs());

        RefreshToken tokenEntity = new RefreshToken(user, tokenHash, expiresAt);
        refreshTokenRepository.save(tokenEntity);

        return new AuthResult(new AuthResponse(UserDto.fromEntity(user), accessToken), refreshToken);
    }
}
