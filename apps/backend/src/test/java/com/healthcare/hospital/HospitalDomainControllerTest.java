package com.healthcare.hospital;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.healthcare.TestcontainersIntegrationTest;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.entity.MedicalService;
import com.healthcare.hospital.entity.Package;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.entity.DoctorBranch;
import com.healthcare.hospital.entity.DoctorSpecialty;
import com.healthcare.hospital.entity.Branch;
import com.healthcare.hospital.repository.DoctorSpecialtyRepository;
import com.healthcare.hospital.repository.ServiceRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.time.OffsetDateTime;

class HospitalDomainControllerTest extends TestcontainersIntegrationTest {

    @Autowired
    private SpecialtyRepository specialtyRepository;

    @Autowired
    private ServiceRepository serviceRepository;

    @Autowired
    private PackageRepository packageRepository;

    @Autowired
    private ArticleRepository articleRepository;

    @Autowired
    private DoctorSpecialtyRepository doctorSpecialtyRepository;

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
    void publicDetailsRequireActiveRowsAndDoctorFilterUsesCatalogLinks() throws Exception {
        Specialty activeSpecialty = new Specialty();
        activeSpecialty.setName("Active specialty");
        activeSpecialty.setSlug("active-specialty-test");
        activeSpecialty.setActive(true);
        specialtyRepository.save(activeSpecialty);

        Specialty inactiveSpecialty = new Specialty();
        inactiveSpecialty.setName("Inactive specialty");
        inactiveSpecialty.setSlug("inactive-specialty-test");
        inactiveSpecialty.setActive(false);
        specialtyRepository.save(inactiveSpecialty);

        Branch activeBranch = new Branch();
        activeBranch.setName("Active branch");
        activeBranch.setSlug("active-branch-test");
        activeBranch.setAddress("Active address");
        activeBranch.setActive(true);
        branchRepository.save(activeBranch);

        Branch inactiveBranch = new Branch();
        inactiveBranch.setName("Inactive branch");
        inactiveBranch.setSlug("inactive-branch-test");
        inactiveBranch.setAddress("Inactive address");
        inactiveBranch.setActive(false);
        branchRepository.save(inactiveBranch);

        Doctor activeDoctor = new Doctor();
        activeDoctor.setFullName("Active doctor");
        activeDoctor.setSlug("active-doctor-test");
        activeDoctor.setActive(true);
        doctorRepository.save(activeDoctor);

        Doctor inactiveDoctor = new Doctor();
        inactiveDoctor.setFullName("Inactive doctor");
        inactiveDoctor.setSlug("inactive-doctor-test");
        inactiveDoctor.setActive(false);
        doctorRepository.save(inactiveDoctor);

        DoctorSpecialty doctorSpecialty = new DoctorSpecialty();
        doctorSpecialty.setDoctor(activeDoctor);
        doctorSpecialty.setSpecialty(activeSpecialty);
        doctorSpecialtyRepository.save(doctorSpecialty);

        DoctorBranch doctorBranch = new DoctorBranch();
        doctorBranch.setDoctor(activeDoctor);
        doctorBranch.setBranch(activeBranch);
        doctorBranchRepository.save(doctorBranch);

        mockMvc.perform(get("/api/v1/hospital/doctors")
                .param("specialtySlug", "active-specialty-test"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalElements").value(1))
            .andExpect(jsonPath("$.content[0].slug").value("active-doctor-test"));

        mockMvc.perform(get("/api/v1/hospital/specialties/inactive-specialty-test"))
            .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/hospital/doctors/inactive-doctor-test"))
            .andExpect(status().isNotFound());
        mockMvc.perform(get("/api/v1/hospital/branches/inactive-branch-test"))
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
        published.setSummary("Published article summary");
        published.setBody("Published article body");
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

    @Test
    void detailPayloadsExposeStructuredStitchContentAndLinkedDoctors() throws Exception {
        Specialty specialty = new Specialty();
        specialty.setName("Cardiology detail");
        specialty.setSlug("cardiology-detail-test");
        specialty.setDescription("Structured specialty content");
        specialty.setCommonSymptoms(JsonNodeFactory.instance.arrayNode().add("Chest discomfort"));
        specialty.setPreparationSteps(JsonNodeFactory.instance.arrayNode().add("Bring prior results"));
        specialty.setCarePathway("Assessment → diagnostics → follow-up");
        specialty.setActive(true);
        specialtyRepository.saveAndFlush(specialty);

        Branch branch = new Branch();
        branch.setName("Structured branch");
        branch.setSlug("structured-branch-test");
        branch.setAddress("Structured address");
        branch.setWorkingHours("07:00–19:00");
        branch.setEmergencyHotline("028 1800 0000");
        branch.setMapUrl("https://maps.example.test/structured-branch");
        branch.setAmenities(JsonNodeFactory.instance.arrayNode().add("Pharmacy").add("Parking"));
        branch.setActive(true);
        branchRepository.saveAndFlush(branch);

        Doctor doctor = new Doctor();
        doctor.setFullName("Structured doctor");
        doctor.setSlug("structured-doctor-test");
        doctor.setActive(true);
        doctorRepository.saveAndFlush(doctor);

        DoctorSpecialty specialtyLink = new DoctorSpecialty();
        specialtyLink.setDoctor(doctor);
        specialtyLink.setSpecialty(specialty);
        doctorSpecialtyRepository.saveAndFlush(specialtyLink);

        DoctorBranch branchLink = new DoctorBranch();
        branchLink.setDoctor(doctor);
        branchLink.setBranch(branch);
        doctorBranchRepository.saveAndFlush(branchLink);

        Package pkg = new Package();
        pkg.setName("Structured package");
        pkg.setSlug("structured-package-test");
        pkg.setDescription("Package with preparation contract");
        pkg.setPrice(BigDecimal.valueOf(1250000));
        pkg.setTargetAudience("Adults with cardiovascular risk");
        pkg.setDurationDays(1);
        pkg.setChecklist(JsonNodeFactory.instance.arrayNode().add("Clinical exam").add("ECG"));
        pkg.setPreparationSteps(JsonNodeFactory.instance.arrayNode().add("Bring medication list"));
        pkg.setActive(true);
        packageRepository.saveAndFlush(pkg);

        Article article = new Article();
        article.setTitle("Structured article");
        article.setSlug("structured-article-test");
        article.setSummary("Structured article summary");
        article.setBody("Fallback article body");
        article.setPublishedAt(OffsetDateTime.now());
        article.setCategory("Prevention");
        article.setAuthorName("Clinical team");
        article.setReadingMinutes(5);
        article.setRelatedSpecialtySlug(specialty.getSlug());
        var articleSections = JsonNodeFactory.instance.arrayNode();
        articleSections.addObject().put("heading", "First section").put("body", "Section body");
        article.setSections(articleSections);
        article.setActive(true);
        articleRepository.saveAndFlush(article);

        mockMvc.perform(get("/api/v1/hospital/specialties/{slug}", specialty.getSlug()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.commonSymptoms[0]").value("Chest discomfort"))
            .andExpect(jsonPath("$.preparationSteps[0]").value("Bring prior results"))
            .andExpect(jsonPath("$.carePathway").value("Assessment → diagnostics → follow-up"))
            .andExpect(jsonPath("$.relatedDoctors[0].fullName").value("Structured doctor"));

        mockMvc.perform(get("/api/v1/hospital/branches/{slug}", branch.getSlug()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.workingHours").value("07:00–19:00"))
            .andExpect(jsonPath("$.amenities[0]").value("Pharmacy"))
            .andExpect(jsonPath("$.doctors[0].fullName").value("Structured doctor"));

        mockMvc.perform(get("/api/v1/hospital/packages/{slug}", pkg.getSlug()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.targetAudience").value("Adults with cardiovascular risk"))
            .andExpect(jsonPath("$.durationDays").value(1))
            .andExpect(jsonPath("$.checklist[1]").value("ECG"))
            .andExpect(jsonPath("$.preparationSteps[0]").value("Bring medication list"));

        mockMvc.perform(get("/api/v1/hospital/articles/{slug}", article.getSlug()))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.category").value("Prevention"))
            .andExpect(jsonPath("$.authorName").value("Clinical team"))
            .andExpect(jsonPath("$.readingMinutes").value(5))
            .andExpect(jsonPath("$.relatedSpecialtySlug").value(specialty.getSlug()))
            .andExpect(jsonPath("$.sections[0].heading").value("First section"));
    }
}
