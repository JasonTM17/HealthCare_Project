package com.healthcare.hospital;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.SpecialtyRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class HospitalDomainControllerTest extends AbstractIntegrationTest {

    @Autowired
    private SpecialtyRepository specialtyRepository;

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
}
