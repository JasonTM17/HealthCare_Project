package com.healthcare.hospital;

import com.healthcare.exception.BadRequestException;
import com.healthcare.exception.ConflictException;
import com.healthcare.hospital.dto.PackageRequest;
import com.healthcare.hospital.entity.Package;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.service.AdminPackageService;
import com.healthcare.hospital.service.PackageService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class PackageImageServiceTest {
    private PackageRepository repository;
    private AdminPackageService service;
    private Package existing;

    @BeforeEach
    void setup() {
        repository = mock(PackageRepository.class);
        service = new AdminPackageService(repository);
        existing = new Package();
        existing.setId(UUID.randomUUID()); existing.setName("Owned package"); existing.setSlug("owned-package");
        existing.setPrice(BigDecimal.valueOf(100000)); existing.setImageUrl("/images/packages/heart-screening.jpg");
        existing.setVersion(3L);
        when(repository.findBySlug("owned-package")).thenReturn(Optional.of(existing));
        when(repository.save(any(Package.class))).thenAnswer(call -> call.getArgument(0));
    }

    @Test
    void imageOverrideLegacyPreserveExplicitClearAndPublicResponse() {
        service.update("owned-package", request("https://images.pexels.com/photos/1/photo.jpg", 3L));
        assertThat(existing.getImageUrl()).isEqualTo("https://images.pexels.com/photos/1/photo.jpg");
        service.update("owned-package", new PackageRequest("Owned package", "owned-package", "Existing facts", existing.getPrice(), true));
        assertThat(existing.getImageUrl()).isEqualTo("https://images.pexels.com/photos/1/photo.jpg");
        when(repository.findBySlugAndActiveTrue("owned-package")).thenReturn(Optional.of(existing));
        assertThat(new PackageService(repository).getBySlug("owned-package").imageUrl()).isEqualTo(existing.getImageUrl());
        service.update("owned-package", request("", 3L));
        assertThat(existing.getImageUrl()).isNull();
    }

    @ParameterizedTest
    @ValueSource(strings = {"javascript:alert(1)", "//evil.example/photo.jpg", "https://evil.example/photo.jpg", "\n", "/broken\nimage.jpg", "/broken image.jpg", "https://user@images.pexels.com/photo.jpg", "https://images.pexels.com:8443/photo.jpg", "/\\evil.jpg"})
    void unsafeImagesRejectBeforeSave(String value) {
        assertThatThrownBy(() -> service.update("owned-package", request(value, 3L))).isInstanceOf(BadRequestException.class);
        verify(repository, never()).save(any());
        assertThat(existing.getImageUrl()).isEqualTo("/images/packages/heart-screening.jpg");
    }

    @Test
    void staleImageFormCannotOverwritePackageFacts() {
        assertThatThrownBy(() -> service.update("owned-package", request("/new.jpg", 2L))).isInstanceOf(ConflictException.class);
        verify(repository, never()).save(any());
        assertThat(existing.getName()).isEqualTo("Owned package");
        assertThat(existing.getPrice()).isEqualByComparingTo("100000");
        assertThat(existing.getImageUrl()).isEqualTo("/images/packages/heart-screening.jpg");
    }

    private PackageRequest request(String image, Long version) {
        return new PackageRequest("Owned package", "owned-package", "Existing facts", existing.getPrice(), true, image, version);
    }
}
