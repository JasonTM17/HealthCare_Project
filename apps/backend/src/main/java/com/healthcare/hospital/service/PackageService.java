package com.healthcare.hospital.service;

import com.healthcare.hospital.dto.PackageResponse;
import com.healthcare.hospital.entity.Package;
import com.healthcare.hospital.repository.PackageRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

@Service
public class PackageService {

    private final PackageRepository packageRepository;

    public PackageService(PackageRepository packageRepository) {
        this.packageRepository = packageRepository;
    }

    public Page<PackageResponse> listActive(Pageable pageable) {
        return packageRepository.findByActiveTrue(pageable).map(this::toResponse);
    }

    public PackageResponse getBySlug(String slug) {
        return packageRepository.findBySlugAndActiveTrue(slug)
            .map(this::toResponse)
            .orElse(null);
    }

    private PackageResponse toResponse(Package pkg) {
        return new PackageResponse(
            pkg.getId().toString(),
            pkg.getName(),
            pkg.getSlug(),
            pkg.getDescription(),
            pkg.getPrice(),
            pkg.getTargetAudience(),
            pkg.getDurationDays(),
            HospitalJsonMapper.strings(pkg.getChecklist()),
            HospitalJsonMapper.strings(pkg.getPreparationSteps())
        );
    }
}
