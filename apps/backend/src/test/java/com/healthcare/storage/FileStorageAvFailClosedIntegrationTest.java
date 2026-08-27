package com.healthcare.storage;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import io.minio.MinioClient;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Regression coverage for the generic upload path when beta AV is mandatory.
 * The scanner endpoint is intentionally unreachable; no object or metadata
 * may be accepted in that state.
 */
@Transactional
class FileStorageAvFailClosedIntegrationTest extends AbstractIntegrationTest {

    private static final String MINIO_IMAGE = "minio/minio:RELEASE.2025-07-23T15-54-02Z";
    private static final String MINIO_ACCESS_KEY = "healthcare-av-test";
    private static final String MINIO_PASSWORD = "local-av-test-password";
    private static final GenericContainer<?> MINIO = new GenericContainer<>(MINIO_IMAGE)
        .withEnv("MINIO_ROOT_USER", MINIO_ACCESS_KEY)
        .withEnv("MINIO_ROOT_PASSWORD", MINIO_PASSWORD)
        .withCommand("server", "/data", "--console-address", ":9001")
        .withExposedPorts(9000)
        .waitingFor(Wait.forHttp("/minio/health/ready").forPort(9000).forStatusCode(200));

    static {
        MINIO.start();
    }

    @DynamicPropertySource
    static void configureObjectStore(DynamicPropertyRegistry registry) {
        registry.add("minio.endpoint", () -> "http://" + MINIO.getHost() + ":" + MINIO.getMappedPort(9000));
        registry.add("minio.access-key", () -> MINIO_ACCESS_KEY);
        registry.add("minio.secret-key", () -> MINIO_PASSWORD);
        registry.add("minio.bucket", () -> "healthcare-files");
        registry.add("storage.av.required", () -> "true");
        registry.add("storage.av.service-url", () -> "http://127.0.0.1:1/scan");
        registry.add("storage.av.service-token", () -> "disposable-av-test-token");
    }

    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenProvider tokenProvider;

    @Test
    void adminUploadFailsClosedWhenScannerIsUnavailable() throws Exception {
        long metadataBefore = storedFileRepository.count();
        mockMvc.perform(multipart("/api/v1/files/upload")
                .file(uploadFile("admin.pdf"))
                .header("Authorization", tokenFor("ADMIN")))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.objectName").doesNotExist());
        assertThat(storedFileRepository.count()).isEqualTo(metadataBefore);
    }

    @Test
    void doctorUploadFailsClosedWhenScannerIsUnavailable() throws Exception {
        long metadataBefore = storedFileRepository.count();
        mockMvc.perform(multipart("/api/v1/files/upload")
                .file(uploadFile("doctor.txt"))
                .header("Authorization", tokenFor("DOCTOR")))
            .andExpect(status().isServiceUnavailable())
            .andExpect(jsonPath("$.objectName").doesNotExist());
        assertThat(storedFileRepository.count()).isEqualTo(metadataBefore);
    }

    private MockMultipartFile uploadFile(String filename) {
        MediaType type = filename.endsWith(".pdf") ? MediaType.APPLICATION_PDF : MediaType.TEXT_PLAIN;
        return new MockMultipartFile("file", filename, type.toString(), "synthetic upload".getBytes());
    }

    private String tokenFor(String roleCode) {
        User user = new User();
        user.setEmail("av-regression." + roleCode.toLowerCase() + "." + UUID.randomUUID() + "@healthcare.local");
        user.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
        user.setDisplayName("AV Regression");
        user.setStatus("ACTIVE");
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        user.addRole(roleRepository.findByCode(roleCode).orElseThrow());
        user = userRepository.saveAndFlush(user);
        return "Bearer " + tokenProvider.generateAccessToken(user.getId(), user.getEmail());
    }
}
