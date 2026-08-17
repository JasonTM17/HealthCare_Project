package com.healthcare.hospital;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.entity.MedicalService;
import com.healthcare.hospital.entity.Package;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.repository.ServiceRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

class HospitalDomainControllerTest extends AbstractIntegrationTest {

    @Autowired
    private SpecialtyRepository specialtyRepository;

    @Autowired
    private ServiceRepository serviceRepository;

    @Autowired
    private PackageRepository packageRepository;

    @Autowired
    private ArticleRepository articleRepository;

    @Test
    void listSpecialtiesReturnsActiveOnly() throws Exception {
        // Arrange — cleanDatabase() from base class ensures isolation
        Specialty active = new Specialty();
        active.setName("Cardiology");
        active.setSlug("cardiology-test");
        active.setDescription("Heart care");
        active.setActive(true);
        specialtyRepository.save(active);

        Specialty inactive = new Specialty();
        inactive.setName("Old Specialty");
        inactive.setSlug("old-specialty-test");
        inactive.setActive(false);
        specialtyRepository.save(inactive);

        // Act & Assert — only active ones in response
        mockMvc.perform(get("/api/v1/hospital/specialties"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].name").value("Cardiology"));
    }

    @Test
    void getSpecialtyBySlug() throws Exception {
        // Arrange
        Specialty specialty = new Specialty();
        specialty.setName("Neurology");
        specialty.setSlug("neurology-test");
        specialty.setActive(true);
        specialtyRepository.save(specialty);

        // Act & Assert
        mockMvc.perform(get("/api/v1/hospital/specialties/neurology-test"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.name").value("Neurology"));
    }

    @Test
    void getSpecialtyBySlugNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/hospital/specialties/does-not-exist"))
            .andExpect(status().isNotFound());
    }

    @Test
    void inactiveServiceAndPackageAreNotPubliclyVisible() throws Exception {
        MedicalService service = new MedicalService();
        service.setName("Inactive service");
        service.setSlug("inactive-service");
        service.setActive(false);
        serviceRepository.save(service);

        Package pkg = new Package();
        pkg.setName("Inactive package");
        pkg.setSlug("inactive-package");
        pkg.setPrice(BigDecimal.ONE);
        pkg.setActive(false);
        packageRepository.save(pkg);

        mockMvc.perform(get("/api/v1/hospital/services/inactive-service"))
            .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/hospital/packages/inactive-package"))
            .andExpect(status().isNotFound());
    }

    @Test
    void inactiveOrUnpublishedArticlesAreNotPubliclyVisible() throws Exception {
        Article inactive = new Article();
        inactive.setTitle("Inactive article");
        inactive.setSlug("inactive-article");
        inactive.setActive(false);
        articleRepository.save(inactive);

        Article unpublished = new Article();
        unpublished.setTitle("Unpublished article");
        unpublished.setSlug("unpublished-article");
        unpublished.setActive(true);
        articleRepository.save(unpublished);

        mockMvc.perform(get("/api/v1/hospital/articles/inactive-article"))
            .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/hospital/articles/unpublished-article"))
            .andExpect(status().isNotFound());
    }

    @Test
    void articleListReturnsOnlyActivePublishedArticles() throws Exception {
        Article published = new Article();
        published.setTitle("Published article");
        published.setSlug("published-article");
        published.setActive(true);
        published.setPublishedAt(OffsetDateTime.now());
        articleRepository.save(published);

        Article unpublished = new Article();
        unpublished.setTitle("Draft article");
        unpublished.setSlug("draft-article");
        unpublished.setActive(true);
        articleRepository.save(unpublished);

        mockMvc.perform(get("/api/v1/hospital/articles"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].slug").value("published-article"));
    }
}
