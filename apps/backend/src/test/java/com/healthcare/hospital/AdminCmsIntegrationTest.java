package com.healthcare.hospital;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthcare.AbstractIntegrationTest;
import com.healthcare.hospital.dto.ArticleRequest;
import com.healthcare.hospital.dto.BranchRequest;
import com.healthcare.hospital.dto.DoctorRequest;
import com.healthcare.hospital.dto.FaqRequest;
import com.healthcare.hospital.dto.PackageRequest;
import com.healthcare.hospital.dto.ServiceRequest;
import com.healthcare.hospital.dto.SpecialtyRequest;
import com.healthcare.security.JwtTokenProvider;
import com.healthcare.user.entity.User;
import com.healthcare.user.repository.RoleRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
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

    private DoctorRequest doctor(String fullName, String slug, boolean active) {
        return new DoctorRequest(fullName, slug, null, null, active, null);
    }

    private SpecialtyRequest specialty(String name, String slug, boolean active) {
        return new SpecialtyRequest(name, slug, "Admin catalog contract test", active);
    }

    private BranchRequest branch(String name, String slug, boolean active) {
        return new BranchRequest(name, slug, "123 Admin Test Street", "028 0000 0000", active);
    }

    private ServiceRequest service(String name, String slug, boolean active) {
        return new ServiceRequest(name, slug, "Admin catalog contract test", active);
    }

    private PackageRequest healthPackage(String name, String slug, boolean active) {
        return new PackageRequest(
            name,
            slug,
            "Admin catalog contract test",
            new BigDecimal("150000"),
            active
        );
    }

    private FaqRequest faq(String question, boolean active) {
        return new FaqRequest(question, "Admin catalog contract answer", active);
    }

    private ArticleRequest article(String title, String slug, boolean active) {
        return new ArticleRequest(
            title,
            slug,
            "Admin catalog contract summary",
            "Admin catalog contract body",
            active
        );
    }

    @Test
    void adminCanListDoctorAndSpecialtyCatalogIncludingInactiveRecords() throws Exception {
        String adminBearer = bearer("ADMIN");
        String doctorSlug = "admin-list-doctor-" + UUID.randomUUID();
        String specialtySlug = "admin-list-specialty-" + UUID.randomUUID();

        mockMvc.perform(post("/api/v1/admin/doctors")
                        .header("Authorization", adminBearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(doctor("Admin List Doctor", doctorSlug, false))))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/admin/specialties")
                        .header("Authorization", adminBearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(specialty("Admin List Specialty", specialtySlug, false))))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/admin/doctors?page=0&size=20")
                .header("Authorization", adminBearer))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].slug").value(doctorSlug))
            .andExpect(jsonPath("$.content[0].active").value(false));

        mockMvc.perform(get("/api/v1/admin/specialties?page=0&size=20")
                .header("Authorization", adminBearer))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].slug").value(specialtySlug))
            .andExpect(jsonPath("$.content[0].active").value(false));
    }

    @Test
    void adminCanListBranchAndServiceCatalogIncludingInactiveRecords() throws Exception {
        String adminBearer = bearer("ADMIN");
        String branchSlug = "admin-list-branch-" + UUID.randomUUID();
        String serviceSlug = "admin-list-service-" + UUID.randomUUID();

        mockMvc.perform(post("/api/v1/admin/branches")
                        .header("Authorization", adminBearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(branch("Admin List Branch", branchSlug, false))))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/admin/services")
                        .header("Authorization", adminBearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(service("Admin List Service", serviceSlug, false))))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/admin/branches?page=0&size=20")
                .header("Authorization", adminBearer))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].slug").value(branchSlug))
            .andExpect(jsonPath("$.content[0].active").value(false));

        mockMvc.perform(get("/api/v1/admin/services?page=0&size=20")
                .header("Authorization", adminBearer))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].slug").value(serviceSlug))
            .andExpect(jsonPath("$.content[0].active").value(false));
    }

    @Test
    void adminCanListRemainingCatalogIncludingInactiveAndUnpublishedRecords() throws Exception {
        String adminBearer = bearer("ADMIN");
        String packageSlug = "admin-list-package-" + UUID.randomUUID();
        String articleSlug = "admin-list-article-" + UUID.randomUUID();
        String question = "Admin list FAQ " + UUID.randomUUID();

        mockMvc.perform(post("/api/v1/admin/packages")
                        .header("Authorization", adminBearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(healthPackage("Admin List Package", packageSlug, false))))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/admin/faqs")
                        .header("Authorization", adminBearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(faq(question, false))))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/admin/articles")
                        .header("Authorization", adminBearer)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(article("Admin List Article", articleSlug, false))))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/admin/packages?page=0&size=20")
                .header("Authorization", adminBearer))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].slug").value(packageSlug))
            .andExpect(jsonPath("$.content[0].active").value(false));

        mockMvc.perform(get("/api/v1/admin/faqs?page=0&size=20")
                .header("Authorization", adminBearer))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].question").value(question))
            .andExpect(jsonPath("$.content[0].active").value(false));

        mockMvc.perform(get("/api/v1/admin/articles?page=0&size=20")
                .header("Authorization", adminBearer))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.content[0].slug").value(articleSlug))
            .andExpect(jsonPath("$.content[0].active").value(false));
    }

    @Test
    void adminCatalogListRequiresAdminRole() throws Exception {
        mockMvc.perform(get("/api/v1/admin/doctors"))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/admin/specialties"))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/admin/branches"))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/admin/services"))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/admin/packages"))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/admin/faqs"))
            .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/admin/articles"))
            .andExpect(status().isUnauthorized());

        String patientBearer = bearer("PATIENT");
        mockMvc.perform(get("/api/v1/admin/doctors")
                .header("Authorization", patientBearer))
            .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/admin/specialties")
                .header("Authorization", patientBearer))
            .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/admin/branches")
                .header("Authorization", patientBearer))
            .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/admin/services")
                .header("Authorization", patientBearer))
            .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/admin/packages")
                .header("Authorization", patientBearer))
            .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/admin/faqs")
                .header("Authorization", patientBearer))
            .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/admin/articles")
                .header("Authorization", patientBearer))
            .andExpect(status().isForbidden());
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
