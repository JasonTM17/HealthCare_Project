package com.healthcare.storage;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.User;
import com.healthcare.appointment.entity.PatientProfile;
import com.healthcare.user.repository.RoleRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
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

import java.util.UUID;

@Transactional
class FileStorageIntegrationTest extends AbstractIntegrationTest {

    private static final String MINIO_IMAGE = "minio/minio:RELEASE.2025-07-23T15-54-02Z";
    private static final String MINIO_ACCESS_KEY = "healthcare-test";
    private static final String TEST_MINIO_PASSWORD = "local-test-password";
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
    }

    @Autowired private ObjectMapper objectMapper;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenProvider tokenProvider;

    private String adminToken() {
        return tokenToken("ADMIN");
    }

    private String doctorToken() {
        return tokenToken("DOCTOR");
    }

    private String patientToken() {
        return createPatientAuth().token();
    }

    private record PatientAuth(String token, PatientProfile profile) {}

    private PatientAuth createPatientAuth() {
        User user = new User();
        user.setEmail("file.patient." + UUID.randomUUID() + "@healthcare.local");
        user.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
        user.setDisplayName("File Patient");
        user.setStatus("ACTIVE");
        user.setCreatedAt(java.time.OffsetDateTime.now());
        user.setUpdatedAt(java.time.OffsetDateTime.now());
        user.addRole(roleRepository.findByCode("PATIENT").orElseThrow());
        user = userRepository.saveAndFlush(user);
        PatientProfile profile = new PatientProfile();
        profile.setFullName("File Patient");
        profile.setPhone("09" + String.format("%08d", Math.abs(UUID.randomUUID().hashCode()) % 100_000_000));
        profile.setEmail(user.getEmail());
        profile.setUserId(user.getId());
        profile = patientProfileRepository.saveAndFlush(profile);
        return new PatientAuth("Bearer " + tokenProvider.generateAccessToken(user.getId(), user.getEmail()), profile);
    }

    private String tokenToken(String roleCode) {
        User user = new User();
        user.setEmail("file.test." + UUID.randomUUID() + "@healthcare.local");
        user.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
        user.setDisplayName("File Test");
        user.setStatus("ACTIVE");
        user.setCreatedAt(java.time.OffsetDateTime.now());
        user.setUpdatedAt(java.time.OffsetDateTime.now());
        user.addRole(roleRepository.findByCode(roleCode).orElseThrow());
        user = userRepository.saveAndFlush(user);
        return "Bearer " + tokenProvider.generateAccessToken(user.getId(), user.getEmail());
    }

    @Test
    void adminCanUploadFile() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
            "file", "test-document.pdf", MediaType.APPLICATION_PDF_VALUE, "test content".getBytes());

        mockMvc.perform(multipart("/api/v1/files/upload")
                .file(file)
                .header("Authorization", adminToken()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.objectName").exists());
    }

    @Test
    void doctorCanUploadFile() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
            "file", "clinical-note.txt", MediaType.TEXT_PLAIN_VALUE, "note".getBytes());

        mockMvc.perform(multipart("/api/v1/files/upload")
                .file(file)
                .header("Authorization", doctorToken()))
            .andExpect(status().isOk());
    }

    @Test
    void doctorCanDownloadOnlyOwnFile() throws Exception {
        String uploaderToken = doctorToken();
        String otherDoctorToken = doctorToken();
        MockMultipartFile file = new MockMultipartFile(
            "file", "clinical-note.txt", MediaType.TEXT_PLAIN_VALUE, "note".getBytes());

        String result = mockMvc.perform(multipart("/api/v1/files/upload")
                .file(file)
                .header("Authorization", uploaderToken))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        String objectName = objectMapper.readTree(result).get("objectName").asText();

        mockMvc.perform(get("/api/v1/files/" + objectName)
                .header("Authorization", uploaderToken))
            .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/files/" + objectName)
                .header("Authorization", otherDoctorToken))
            .andExpect(status().isForbidden());
    }

    @Test
    void rejectsUnsupportedUploadType() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
            "file", "malware.zip", "application/zip", "not an allowed document".getBytes());

        mockMvc.perform(multipart("/api/v1/files/upload")
                .file(file)
                .header("Authorization", adminToken()))
            .andExpect(status().isBadRequest());
    }

    @Test
    void patientCannotUploadFile() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
            "file", "hack.txt", MediaType.TEXT_PLAIN_VALUE, "x".getBytes());

        mockMvc.perform(multipart("/api/v1/files/upload")
                .file(file)
                .header("Authorization", patientToken()))
            .andExpect(status().isForbidden());
    }

    @Test
    void unauthenticatedCannotUpload() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
            "file", "anon.txt", MediaType.TEXT_PLAIN_VALUE, "x".getBytes());

        mockMvc.perform(multipart("/api/v1/files/upload").file(file))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void adminCanDeleteFile() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
            "file", "to-delete.txt", MediaType.TEXT_PLAIN_VALUE, "delete me".getBytes());

        String result = mockMvc.perform(multipart("/api/v1/files/upload")
                .file(file)
                .header("Authorization", adminToken()))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        String objectName = objectMapper.readTree(result).get("objectName").asText();

        mockMvc.perform(delete("/api/v1/files/" + objectName)
                .header("Authorization", adminToken()))
            .andExpect(status().isNoContent());
    }

    @Test
    void patientCannotDeleteFile() throws Exception {
        mockMvc.perform(delete("/api/v1/files/some-object")
                .header("Authorization", patientToken()))
            .andExpect(status().isForbidden());
    }

    @Test
    void patientCannotDownloadArbitraryObject() throws Exception {
        mockMvc.perform(get("/api/v1/files/00000000-0000-0000-0000-000000000000-file.txt")
                .header("Authorization", patientToken()))
            .andExpect(status().isForbidden());
    }

    @Test
    void patientCanDownloadFileLinkedToOwnProfile() throws Exception {
        PatientAuth patient = createPatientAuth();
        MockMultipartFile file = new MockMultipartFile(
            "file", "patient-result.pdf", MediaType.APPLICATION_PDF_VALUE, "result".getBytes());
        String result = mockMvc.perform(multipart("/api/v1/files/upload")
                .file(file)
                .param("patientId", patient.profile().getId().toString())
                .param("purpose", "DIAGNOSTIC_RESULT")
                .header("Authorization", adminToken()))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        String objectName = objectMapper.readTree(result).get("objectName").asText();

        mockMvc.perform(get("/api/v1/files/" + objectName)
                .header("Authorization", patient.token()))
            .andExpect(status().isOk());
    }

    @Test
    void adminCanDownloadFile() throws Exception {
        byte[] content = "downloadable content".getBytes();
        MockMultipartFile file = new MockMultipartFile(
            "file", "downloadable.txt", MediaType.TEXT_PLAIN_VALUE, content);

        String result = mockMvc.perform(multipart("/api/v1/files/upload")
                .file(file)
                .header("Authorization", adminToken()))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();

        String objectName = objectMapper.readTree(result).get("objectName").asText();

        mockMvc.perform(get("/api/v1/files/" + objectName)
                .header("Authorization", adminToken()))
            .andExpect(status().isOk());
    }
}
