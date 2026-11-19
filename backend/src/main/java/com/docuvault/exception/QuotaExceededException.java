package com.docuvault.exception;

import org.springframework.http.HttpStatus;

public class QuotaExceededException extends AppException {
    public QuotaExceededException(String message) {
        super(message, HttpStatus.PAYLOAD_TOO_LARGE);
    }
}
