package com.healthcare.storage;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Transactional
class FileStorageIntegrationTest extends AbstractIntegrationTest {

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
        return tokenToken("PATIENT");
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
