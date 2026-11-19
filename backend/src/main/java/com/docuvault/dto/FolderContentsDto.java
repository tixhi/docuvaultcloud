package com.docuvault.dto;

import java.util.List;

public record FolderContentsDto(
        List<FolderDto> folders,
        List<FileDto> files,
        List<BreadcrumbDto> breadcrumbs
) {}
