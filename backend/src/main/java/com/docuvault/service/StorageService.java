package com.docuvault.service;

import java.io.InputStream;
import java.util.UUID;

public interface StorageService {

    String buildKey(UUID ownerId, String extension);

    String put(byte[] bytes, String key, String contentType);

    InputStream getStream(String key);

    void delete(String key);

    boolean exists(String key);

    String getDownloadUrl(String key, String filename, boolean forceDownload);

    String getUploadUrl(String key, String contentType);

    String calculateChecksum(byte[] bytes);

    String getDriverName();
}
