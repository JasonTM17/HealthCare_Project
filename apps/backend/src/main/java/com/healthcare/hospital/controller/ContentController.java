package com.healthcare.hospital.controller;

import com.healthcare.common.SafePageRequests;
import com.healthcare.hospital.dto.PackageResponse;
import com.healthcare.hospital.dto.ServiceResponse;
import com.healthcare.hospital.entity.Package;
import com.healthcare.hospital.entity.MedicalService;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.ServiceRepository;
import com.healthcare.exception.ResourceNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;

@RestController
@RequestMapping("/api/v1/hospital")
public class ContentController {

    private static final Set<String> CATALOG_SORT_PROPERTIES = Set.of("id", "name", "slug", "price");

    private final ServiceRepository serviceRepository;
    private final PackageRepository packageRepository;

    public ContentController(ServiceRepository serviceRepository, PackageRepository packageRepository) {
        this.serviceRepository = serviceRepository;
        this.packageRepository = packageRepository;
    }

    @GetMapping("/services")
    public Page<ServiceResponse> listServices(@PageableDefault(size = 20) Pageable pageable) {
        return serviceRepository.findByActiveTrue(safePageable(pageable)).map(this::toServiceResponse);
    }

    @GetMapping("/services/{slug}")
    public ServiceResponse getServiceBySlug(@PathVariable String slug) {
        return serviceRepository.findBySlugAndActiveTrue(slug)
            .map(this::toServiceResponse)
            .orElseThrow(() -> new ResourceNotFoundException("Service not found"));
    }

    @GetMapping("/packages")
    public Page<PackageResponse> listPackages(@PageableDefault(size = 20) Pageable pageable) {
        return packageRepository.findByActiveTrue(safePageable(pageable)).map(this::toPackageResponse);
    }

    private Pageable safePageable(Pageable pageable) {
        return SafePageRequests.normalize(pageable, Sort.unsorted(), CATALOG_SORT_PROPERTIES);
    }

    @GetMapping("/packages/{slug}")
    public PackageResponse getPackageBySlug(@PathVariable String slug) {
        return packageRepository.findBySlugAndActiveTrue(slug)
            .map(this::toPackageResponse)
            .orElseThrow(() -> new ResourceNotFoundException("Package not found"));
    }

    private ServiceResponse toServiceResponse(MedicalService service) {
        return new ServiceResponse(service.getId().toString(), service.getName(), service.getSlug(), service.getDescription());
    }

    private PackageResponse toPackageResponse(Package pkg) {
        return new PackageResponse(
            pkg.getId().toString(),
            pkg.getName(),
            pkg.getSlug(),
            pkg.getDescription(),
            pkg.getPrice(),
            pkg.getTargetAudience(),
            pkg.getDurationDays(),
            com.healthcare.hospital.service.HospitalJsonMapper.strings(pkg.getChecklist()),
            com.healthcare.hospital.service.HospitalJsonMapper.strings(pkg.getPreparationSteps())
        );
    }
}
