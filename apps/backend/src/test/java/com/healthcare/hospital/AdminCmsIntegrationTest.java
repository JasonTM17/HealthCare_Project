package com.healthcare.hospital;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.AbstractIntegrationTest;
import com.healthcare.hospital.dto.DoctorRequest;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Transactional
class AdminCmsIntegrationTest extends AbstractIntegrationTest {

    @Autowired private ObjectMapper objectMapper;
    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenProvider tokenProvider;

    private User createUserWithRole(String roleCode) {
        User user = new User();
        user.setEmail("admin.test." + UUID.randomUUID() + "@healthcare.local");
        user.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
        user.setDisplayName("Admin Test");
        user.setStatus("ACTIVE");
        user.setCreatedAt(java.time.OffsetDateTime.now());
        user.setUpdatedAt(java.time.OffsetDateTime.now());
        user.addRole(roleRepository.findByCode(roleCode).orElseThrow());
        return userRepository.saveAndFlush(user);
    }

    private String bearer(String roleCode) {
        User user = createUserWithRole(roleCode);
        return "Bearer " + tokenProvider.generateAccessToken(user.getId(), user.getEmail());
    }

    private DoctorRequest doctor(String fullName, String slug) {
        return new DoctorRequest(fullName, slug, null, null, true, null);
    }

    @Test
    void adminCanCreateDoctor() throws Exception {
        String body = objectMapper.writeValueAsString(doctor("BS.CKI Test Admin", "bs-cki-test-admin"));

        mockMvc.perform(post("/api/v1/admin/doctors")
                .header("Authorization", bearer("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.fullName").value("BS.CKI Test Admin"))
            .andExpect(jsonPath("$.slug").value("bs-cki-test-admin"));
    }

    @Test
    void patientCannotCreateDoctor() throws Exception {
        String body = objectMapper.writeValueAsString(doctor("Unauthorized", "unauthorized-slug"));

        mockMvc.perform(post("/api/v1/admin/doctors")
                .header("Authorization", bearer("PATIENT"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isForbidden());
    }

    @Test
    void doctorCannotCreateDoctor() throws Exception {
        String body = objectMapper.writeValueAsString(doctor("Unauthorized", "unauthorized-slug"));

        mockMvc.perform(post("/api/v1/admin/doctors")
                .header("Authorization", bearer("DOCTOR"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isForbidden());
    }

    @Test
    void duplicateSlugIsRejected() throws Exception {
        String body = objectMapper.writeValueAsString(doctor("Unique Doctor", "duplicate-slug-test"));

        mockMvc.perform(post("/api/v1/admin/doctors")
                .header("Authorization", bearer("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/admin/doctors")
                .header("Authorization", bearer("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isConflict());
    }

    @Test
    void invalidDoctorRequestIsRejected() throws Exception {
        String body = objectMapper.writeValueAsString(doctor("", "invalid-slug"));

        mockMvc.perform(post("/api/v1/admin/doctors")
                .header("Authorization", bearer("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(body))
            .andExpect(status().isBadRequest());
    }

    @Test
    void adminCanUpdateAndDeleteDoctor() throws Exception {
        String createBody = objectMapper.writeValueAsString(doctor("To Update", "update-slug-test"));

        mockMvc.perform(post("/api/v1/admin/doctors")
                .header("Authorization", bearer("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(createBody))
            .andExpect(status().isOk());

        String updateBody = objectMapper.writeValueAsString(doctor("Updated Name", "update-slug-test"));

        mockMvc.perform(put("/api/v1/admin/doctors/update-slug-test")
                .header("Authorization", bearer("ADMIN"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(updateBody))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.fullName").value("Updated Name"));

        mockMvc.perform(delete("/api/v1/admin/doctors/update-slug-test")
                .header("Authorization", bearer("ADMIN")))
            .andExpect(status().isNoContent());
    }
}
