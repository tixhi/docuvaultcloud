package com.docuvault.service.impl;

import com.docuvault.exception.AppException;
import com.docuvault.service.StorageService;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;
import java.util.UUID;

@Service("localStorageService")
public class LocalStorageServiceImpl implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(LocalStorageServiceImpl.class);
    private final Path rootPath;
    private final SecureRandom secureRandom = new SecureRandom();

    public LocalStorageServiceImpl(@Value("${docuvault.storage.local-path:./storage}") String storagePath) {
        this.rootPath = Paths.get(storagePath).toAbsolutePath().normalize();
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(rootPath);
            log.info("Initialized local disk storage directory at: {}", rootPath);
        } catch (IOException e) {
            log.error("Could not initialize storage directory", e);
            throw new AppException("Could not initialize local storage folder");
        }
    }

    @Override
    public String buildKey(UUID ownerId, String extension) {
        byte[] shardBytes = new byte[2];
        secureRandom.nextBytes(shardBytes);
        String shard = HexFormat.of().formatHex(shardBytes);
        String fileId = UUID.randomUUID().toString();
        String ext = (extension != null && !extension.trim().isEmpty()) ? "." + extension.replace(".", "") : "";
        return ownerId + "/" + shard + "/" + fileId + ext;
    }

    @Override
    public String put(byte[] bytes, String key, String contentType) {
        try {
            Path target = rootPath.resolve(key).normalize();
            if (!target.startsWith(rootPath)) {
                throw new AppException("Invalid storage path key traversal");
            }
            Files.createDirectories(target.getParent());
            Files.write(target, bytes);
            return key;
        } catch (IOException e) {
            log.error("Failed to write file to local disk: {}", key, e);
            throw new AppException("Failed to store file: " + e.getMessage());
        }
    }

    @Override
    public InputStream getStream(String key) {
        try {
            Path target = rootPath.resolve(key).normalize();
            if (!target.startsWith(rootPath) || !Files.exists(target)) {
                throw new AppException("Stored file not found on disk");
            }
            return Files.newInputStream(target);
        } catch (IOException e) {
            throw new AppException("Failed to read file from local disk: " + e.getMessage());
        }
    }

    @Override
    public void delete(String key) {
        try {
            Path target = rootPath.resolve(key).normalize();
            if (target.startsWith(rootPath)) {
                Files.deleteIfExists(target);
            }
        } catch (IOException e) {
            log.warn("Failed to delete local file {}: {}", key, e.getMessage());
        }
    }

    @Override
    public boolean exists(String key) {
        Path target = rootPath.resolve(key).normalize();
        return target.startsWith(rootPath) && Files.exists(target);
    }

    @Override
    public String getDownloadUrl(String key, String filename, boolean forceDownload) {
        return null; // Local storage uses streaming controller endpoint
    }

    @Override
    public String getUploadUrl(String key, String contentType) {
        return null; // Local storage uploads via multipart endpoint
    }

    @Override
    public String calculateChecksum(byte[] bytes) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(bytes);
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new AppException("SHA-256 algorithm unavailable");
        }
    }

    @Override
    public String getDriverName() {
        return "local";
    }
}
