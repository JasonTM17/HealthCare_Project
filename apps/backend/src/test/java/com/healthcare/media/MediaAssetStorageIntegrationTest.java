package com.healthcare.media;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.AbstractIntegrationTest;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Transactional
class MediaAssetStorageIntegrationTest extends AbstractIntegrationTest {

    private static final String MINIO_IMAGE = "minio/minio:RELEASE.2025-07-23T15-54-02Z";
    private static final String MINIO_ACCESS_KEY = "healthcare-media-test";
    private static final String TEST_MINIO_PASSWORD = "local-media-test-password";
    private static final GenericContainer<?> MINIO = new GenericContainer<>(MINIO_IMAGE)
        .withEnv("MINIO_ROOT_USER", MINIO_ACCESS_KEY)
        .withEnv("MINIO_ROOT_PASSWORD", TEST_MINIO_PASSWORD)
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
        registry.add("minio.secret-key", () -> TEST_MINIO_PASSWORD);
        registry.add("minio.bucket", () -> "healthcare-files");
        registry.add("storage.upload-enabled", () -> "true");
        registry.add("storage.allow-unscanned-upload", () -> "true");
    }

    @Autowired private ObjectMapper objectMapper;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenProvider tokenProvider;

    @Test
    void mediaUploadUsesPublicObjectStorageAndKeepsPrivateFileBoundary() throws Exception {
        byte[] webp = webpBytes();
        long privateMetadataBefore = storedFileRepository.count();

        String body = mockMvc.perform(multipart("/api/v1/media/upload")
                .file(new MockMultipartFile("file", "doctor portrait.webp", "image/webp", webp))
                .param("purpose", "DOCTOR_PORTRAIT")
                .header("Authorization", tokenFor("DOCTOR")))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.url").exists())
            .andReturn()
            .getResponse()
            .getContentAsString();

        UUID mediaId = UUID.fromString(objectMapper.readTree(body).get("id").asText());
        String objectKey = jdbcTemplate.queryForObject(
            "select object_key from media_assets where id = ?",
            String.class,
            mediaId
        );
        Boolean inlineDataIsNull = jdbcTemplate.queryForObject(
            "select data is null from media_assets where id = ?",
            Boolean.class,
            mediaId
        );

        assertThat(objectKey).startsWith("public/media/");
        assertThat(inlineDataIsNull).isTrue();
        assertThat(storedFileRepository.count()).isEqualTo(privateMetadataBefore);

        mockMvc.perform(get("/api/v1/media/" + mediaId))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith("image/webp"))
            .andExpect(content().bytes(webp));

        mockMvc.perform(multipart("/api/v1/files/upload")
                .file(new MockMultipartFile("file", "private.webp", "image/webp", webp))
                .header("Authorization", tokenFor("ADMIN")))
            .andExpect(status().isBadRequest());
        assertThat(storedFileRepository.count()).isEqualTo(privateMetadataBefore);
    }

    @Test
    void legacyInlineMediaStillServesBeforeOperatorBackfill() throws Exception {
        UUID mediaId = UUID.randomUUID();
        byte[] png = pngBytes();
        jdbcTemplate.update("""
            insert into media_assets(id, filename, content_type, size_bytes, data, uploader_role, purpose)
            values (?, ?, ?, ?, ?, ?, ?)
            """,
            mediaId,
            "legacy.png",
            "image/png",
            png.length,
            png,
            "ADMIN",
            "ARTICLE_COVER");

        mockMvc.perform(get("/api/v1/media/" + mediaId))
            .andExpect(status().isOk())
            .andExpect(content().contentTypeCompatibleWith(MediaType.IMAGE_PNG))
            .andExpect(content().bytes(png));
    }

    private String tokenFor(String roleCode) {
        User user = new User();
        user.setEmail("media.storage." + roleCode.toLowerCase() + "." + UUID.randomUUID() + "@healthcare.local");
        user.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
        user.setDisplayName("Media Storage");
        user.setStatus("ACTIVE");
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        user.addRole(roleRepository.findByCode(roleCode).orElseThrow());
        user = userRepository.saveAndFlush(user);
        return "Bearer " + tokenProvider.generateAccessToken(user.getId(), user.getEmail());
    }

    private byte[] webpBytes() {
        return new byte[] {
            'R', 'I', 'F', 'F', 0, 0, 0, 0, 'W', 'E', 'B', 'P', 'V', 'P', '8', ' ', 0, 0, 0, 0
        };
    }

    private byte[] pngBytes() {
        return new byte[] {
            (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 0
        };
    }
}
