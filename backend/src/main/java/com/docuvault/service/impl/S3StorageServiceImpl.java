package com.docuvault.service.impl;

import com.docuvault.exception.AppException;
import com.docuvault.service.StorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseInputStream;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.model.PutObjectPresignRequest;

import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.HexFormat;
import java.util.UUID;

@Service("s3StorageService")
public class S3StorageServiceImpl implements StorageService {

    private static final Logger log = LoggerFactory.getLogger(S3StorageServiceImpl.class);

    private final S3Client s3Client;
    private final S3Presigner s3Presigner;
    private final String bucket;
    private final String kmsKeyId;
    private final int presignedUrlTtlSeconds;
    private final SecureRandom secureRandom = new SecureRandom();

    public S3StorageServiceImpl(
            S3Client s3Client,
            S3Presigner s3Presigner,
            @Value("${docuvault.aws.s3-bucket:your-docuvault-bucket}") String bucket,
            @Value("${docuvault.aws.s3-kms-key-id:}") String kmsKeyId,
            @Value("${docuvault.aws.s3-presigned-url-ttl:300}") int presignedUrlTtlSeconds
    ) {
        this.s3Client = s3Client;
        this.s3Presigner = s3Presigner;
        this.bucket = bucket;
        this.kmsKeyId = kmsKeyId;
        this.presignedUrlTtlSeconds = presignedUrlTtlSeconds;
    }

    private void assertBucket() {
        if (bucket == null || bucket.isBlank() || "your-docuvault-bucket".equalsIgnoreCase(bucket)) {
            throw new AppException("S3_BUCKET is not properly configured for S3 storage driver.");
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
        assertBucket();
        try {
            PutObjectRequest.Builder builder = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .contentType(contentType != null ? contentType : "application/octet-stream");

            if (kmsKeyId != null && !kmsKeyId.isBlank()) {
                builder.serverSideEncryption(ServerSideEncryption.AWS_KMS).ssekmsKeyId(kmsKeyId);
            } else {
                builder.serverSideEncryption(ServerSideEncryption.AES256);
            }

            s3Client.putObject(builder.build(), RequestBody.fromBytes(bytes));
            return key;
        } catch (Exception e) {
            log.error("Failed to upload object to S3: {}", key, e);
            throw new AppException("Failed to upload object to S3: " + e.getMessage());
        }
    }

    @Override
    public InputStream getStream(String key) {
        assertBucket();
        try {
            GetObjectRequest request = GetObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .build();
            ResponseInputStream<GetObjectResponse> s3Stream = s3Client.getObject(request);
            return s3Stream;
        } catch (Exception e) {
            log.error("Failed to fetch stream from S3: {}", key, e);
            throw new AppException("Failed to read file from S3: " + e.getMessage());
        }
    }

    @Override
    public void delete(String key) {
        assertBucket();
        try {
            DeleteObjectRequest request = DeleteObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .build();
            s3Client.deleteObject(request);
        } catch (Exception e) {
            log.warn("Failed to delete S3 object {}: {}", key, e.getMessage());
        }
    }

    @Override
    public boolean exists(String key) {
        assertBucket();
        try {
            HeadObjectRequest request = HeadObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .build();
            s3Client.headObject(request);
            return true;
        } catch (NoSuchKeyException e) {
            return false;
        } catch (Exception e) {
            log.warn("Error checking existence for key {}: {}", key, e.getMessage());
            return false;
        }
    }

    @Override
    public String getDownloadUrl(String key, String filename, boolean forceDownload) {
        assertBucket();
        try {
            String disposition = (forceDownload ? "attachment" : "inline");
            if (filename != null && !filename.isBlank()) {
                disposition += "; filename=\"" + URLEncoder.encode(filename, StandardCharsets.UTF_8).replace("+", "%20") + "\"";
            }

            GetObjectRequest getObjectRequest = GetObjectRequest.builder()
                    .bucket(bucket)
                    .key(key)
                    .responseContentDisposition(disposition)
                    .build();

            GetObjectPresignRequest presignRequest = GetObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofSeconds(presignedUrlTtlSeconds))
                    .getObjectRequest(getObjectRequest)
                    .build();

            PresignedGetObjectRequest presigned = s3Presigner.presignGetObject(presignRequest);
            return presigned.url().toString();
        } catch (Exception e) {
            log.error("Failed to generate presigned download URL for {}: {}", key, e.getMessage());
            throw new AppException("Failed to generate presigned download URL: " + e.getMessage());
        }
    }

    @Override
    public String getUploadUrl(String key, String contentType) {
        assertBucket();
        try {
            PutObjectRequest.Builder putBuilder = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(key);

            if (contentType != null && !contentType.isBlank()) {
                putBuilder.contentType(contentType);
            }

            if (kmsKeyId != null && !kmsKeyId.isBlank()) {
                putBuilder.serverSideEncryption(ServerSideEncryption.AWS_KMS).ssekmsKeyId(kmsKeyId);
            } else {
                putBuilder.serverSideEncryption(ServerSideEncryption.AES256);
            }

            PutObjectPresignRequest presignRequest = PutObjectPresignRequest.builder()
                    .signatureDuration(Duration.ofSeconds(presignedUrlTtlSeconds))
                    .putObjectRequest(putBuilder.build())
                    .build();

            PresignedPutObjectRequest presigned = s3Presigner.presignPutObject(presignRequest);
            return presigned.url().toString();
        } catch (Exception e) {
            log.error("Failed to generate presigned upload URL for {}: {}", key, e.getMessage());
            throw new AppException("Failed to generate presigned upload URL: " + e.getMessage());
        }
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
        return "s3";
    }
}
