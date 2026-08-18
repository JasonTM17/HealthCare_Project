package com.healthcare.hospital;

import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.service.PackageService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PackageServiceTest {

    @Mock
    private PackageRepository packageRepository;

    @Test
    void inactivePackagesAreNotReturnedBySlug() {
        PackageService service = new PackageService(packageRepository);
        when(packageRepository.findBySlugAndActiveTrue("inactive-package"))
            .thenReturn(Optional.empty());

        assertThat(service.getBySlug("inactive-package")).isNull();
        verify(packageRepository).findBySlugAndActiveTrue("inactive-package");
        verify(packageRepository, never()).findBySlug("inactive-package");
    }
}
