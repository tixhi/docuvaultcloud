package com.docuvault.config;

import com.docuvault.service.StorageService;
import com.docuvault.service.impl.LocalStorageServiceImpl;
import com.docuvault.service.impl.S3StorageServiceImpl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

@Configuration
public class StorageConfig {

    private static final Logger log = LoggerFactory.getLogger(StorageConfig.class);

    @Value("${docuvault.storage.driver:local}")
    private String driverName;

    @Bean
    @Primary
    public StorageService storageService(LocalStorageServiceImpl localService, S3StorageServiceImpl s3Service) {
        if ("s3".equalsIgnoreCase(driverName)) {
            log.info("Active storage provider: AWS S3 Storage Service");
            return s3Service;
        }
        log.info("Active storage provider: Local Disk Storage Service");
        return localService;
    }
}
