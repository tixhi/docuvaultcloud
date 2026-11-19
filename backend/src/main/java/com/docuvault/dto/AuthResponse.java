package com.docuvault.dto;

public record AuthResponse(
        UserDto user,
        String accessToken
) {}
