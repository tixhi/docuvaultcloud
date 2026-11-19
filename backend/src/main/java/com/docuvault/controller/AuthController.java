package com.docuvault.controller;

import com.docuvault.dto.ApiResponse;
import com.docuvault.dto.AuthResponse;
import com.docuvault.dto.LoginRequest;
import com.docuvault.dto.RegisterRequest;
import com.docuvault.dto.UserDto;
import com.docuvault.entity.User;
import com.docuvault.exception.UnauthorizedException;
import com.docuvault.repository.UserRepository;
import com.docuvault.security.UserPrincipal;
import com.docuvault.service.AuthService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final UserRepository userRepository;

    public AuthController(AuthService authService, UserRepository userRepository) {
        this.authService = authService;
        this.userRepository = userRepository;
    }

    private String getClientIp(HttpServletRequest request) {
        String xf = request.getHeader("X-Forwarded-For");
        if (xf != null && !xf.isBlank()) {
            return xf.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private ResponseCookie createRefreshTokenCookie(String refreshToken, long maxAgeSeconds) {
        return ResponseCookie.from("refreshToken", refreshToken)
                .httpOnly(true)
                .secure(false) // set to true in production HTTPS
                .sameSite("Lax")
                .path("/api/auth")
                .maxAge(maxAgeSeconds)
                .build();
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest req,
                                                 HttpServletRequest request,
                                                 HttpServletResponse response) {
        AuthService.AuthResult result = authService.register(req, getClientIp(request));
        ResponseCookie cookie = createRefreshTokenCookie(result.rawRefreshToken(), 7 * 24 * 3600);
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        return ResponseEntity.status(HttpStatus.CREATED).body(result.authResponse());
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest req,
                                              HttpServletRequest request,
                                              HttpServletResponse response) {
        AuthService.AuthResult result = authService.login(req, getClientIp(request));
        ResponseCookie cookie = createRefreshTokenCookie(result.rawRefreshToken(), 7 * 24 * 3600);
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        return ResponseEntity.ok(result.authResponse());
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@CookieValue(name = "refreshToken", required = false) String cookieToken,
                                                HttpServletRequest request) {
        String token = cookieToken;
        if (token == null && request.getCookies() != null) {
            token = Arrays.stream(request.getCookies())
                    .filter(c -> "refreshToken".equals(c.getName()))
                    .map(Cookie::getValue)
                    .findFirst()
                    .orElse(null);
        }

        if (token == null) {
            throw new UnauthorizedException("No refresh token provided.");
        }

        AuthResponse authResponse = authService.refresh(token);
        return ResponseEntity.ok(authResponse);
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiResponse> logout(@CookieValue(name = "refreshToken", required = false) String token,
                                              @AuthenticationPrincipal UserPrincipal principal,
                                              HttpServletRequest request,
                                              HttpServletResponse response) {
        authService.logout(token, principal != null ? principal.getId() : null, getClientIp(request));
        ResponseCookie cookie = createRefreshTokenCookie("", 0);
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        return ResponseEntity.ok(ApiResponse.success("Logged out."));
    }

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> me(@AuthenticationPrincipal UserPrincipal principal) {
        if (principal == null) {
            throw new UnauthorizedException("Not authenticated");
        }
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new UnauthorizedException("User not found"));

        Map<String, Object> resp = new HashMap<>();
        resp.put("user", UserDto.fromEntity(user));
        return ResponseEntity.ok(resp);
    }
}
