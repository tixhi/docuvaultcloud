package com.docuvault.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;

@Configuration
public class AwsS3Config {

    private static final Logger log = LoggerFactory.getLogger(AwsS3Config.class);

    @Value("${docuvault.aws.region:us-east-1}")
    private String awsRegion;

    @Value("${docuvault.aws.access-key-id:}")
    private String accessKeyId;

    @Value("${docuvault.aws.secret-access-key:}")
    private String secretAccessKey;

    private AwsCredentialsProvider getCredentialsProvider() {
        if (accessKeyId != null && !accessKeyId.isBlank() && secretAccessKey != null && !secretAccessKey.isBlank()) {
            log.info("Using explicitly configured AWS static credentials");
            return StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKeyId, secretAccessKey));
        }
        log.info("Using AWS DefaultCredentialsProvider chain (IAM role, env vars, etc.)");
        return DefaultCredentialsProvider.create();
    }

    @Bean
    public S3Client s3Client() {
        Region region = Region.of(awsRegion);
        return S3Client.builder()
                .region(region)
                .credentialsProvider(getCredentialsProvider())
                .build();
    }

    @Bean
    public S3Presigner s3Presigner() {
        Region region = Region.of(awsRegion);
        return S3Presigner.builder()
                .region(region)
                .credentialsProvider(getCredentialsProvider())
                .build();
    }
}
