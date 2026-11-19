package com.docuvault.dto;

import java.util.UUID;

public record BreadcrumbDto(
        UUID id,
        String name
) {}
