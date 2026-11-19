package com.docuvault;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

@SpringBootApplication
@EnableJpaAuditing
public class DocuVaultApplication {

    public static void main(String[] args) {
        SpringApplication.run(DocuVaultApplication.class, args);
    }
}
