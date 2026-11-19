package com.docuvault.dto;

public record ApiResponse(
        String message,
        String error
) {
    public static ApiResponse success(String message) {
        return new ApiResponse(message, null);
    }

    public static ApiResponse error(String error) {
        return new ApiResponse(null, error);
    }
}
