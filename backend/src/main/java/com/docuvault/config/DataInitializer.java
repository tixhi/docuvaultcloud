package com.docuvault.config;

import com.docuvault.entity.User;
import com.docuvault.entity.UserRole;
import com.docuvault.repository.UserRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataInitializer implements CommandLineRunner {

    private static final Logger log = LoggerFactory.getLogger(DataInitializer.class);

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${docuvault.seed.admin-email:admin@docuvault.local}")
    private String adminEmail;

    @Value("${docuvault.seed.admin-password:Admin@12345}")
    private String adminPassword;

    @Value("${docuvault.seed.admin-name:System Administrator}")
    private String adminName;

    public DataInitializer(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public void run(String... args) {
        if (!userRepository.existsByEmailIgnoreCase(adminEmail)) {
            log.info("Seeding initial administrator user: {}", adminEmail);
            User admin = new User(
                    adminName,
                    adminEmail.toLowerCase().trim(),
                    passwordEncoder.encode(adminPassword),
                    UserRole.ADMIN
            );
            userRepository.save(admin);
            log.info("Administrator user seeded successfully.");
        }
    }
}
