package com.healthcare.storage;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.UUID;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Transactional
class FileStorageUploadDisabledIntegrationTest extends AbstractIntegrationTest {

    @Autowired private RoleRepository roleRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtTokenProvider tokenProvider;

    @Test
    void unpackagedDefaultRejectsGenericUpload() throws Exception {
        User user = new User();
        user.setEmail("upload.disabled." + UUID.randomUUID() + "@healthcare.local");
        user.setPasswordHash(passwordEncoder.encode("NotUsed!123"));
        user.setDisplayName("Upload Disabled");
        user.setStatus("ACTIVE");
        user.setCreatedAt(OffsetDateTime.now());
        user.setUpdatedAt(OffsetDateTime.now());
        user.addRole(roleRepository.findByCode("ADMIN").orElseThrow());
        user = userRepository.saveAndFlush(user);
        String token = "Bearer " + tokenProvider.generateAccessToken(user.getId(), user.getEmail());

        mockMvc.perform(multipart("/api/v1/files/upload")
                .file(new MockMultipartFile(
                    "file", "test-document.pdf", MediaType.APPLICATION_PDF_VALUE, "%PDF-1.7\ntest".getBytes()))
                .header("Authorization", token))
            .andExpect(status().isServiceUnavailable());
    }
}
