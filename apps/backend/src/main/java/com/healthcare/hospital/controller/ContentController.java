package com.healthcare.hospital.controller;

import com.healthcare.hospital.dto.PackageResponse;
import com.healthcare.hospital.dto.ServiceResponse;
import com.healthcare.hospital.entity.Package;
import com.healthcare.hospital.entity.Service;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.ServiceRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/hospital")
public class ContentController {

    private final ServiceRepository serviceRepository;
    private final PackageRepository packageRepository;

    public ContentController(ServiceRepository serviceRepository, PackageRepository packageRepository) {
        this.serviceRepository = serviceRepository;
        this.packageRepository = packageRepository;
    }

    @GetMapping("/services")
    public Page<ServiceResponse> listServices(@PageableDefault(size = 20) Pageable pageable) {
        return serviceRepository.findByActiveTrue(pageable).map(this::toServiceResponse);
    }

    @GetMapping("/services/{slug}")
    public ServiceResponse getServiceBySlug(@PathVariable String slug) {
        return serviceRepository.findBySlug(slug).map(this::toServiceResponse).orElse(null);
    }

    @GetMapping("/packages")
    public Page<PackageResponse> listPackages(@PageableDefault(size = 20) Pageable pageable) {
        return packageRepository.findByActiveTrue(pageable).map(this::toPackageResponse);
    }

    @GetMapping("/packages/{slug}")
    public PackageResponse getPackageBySlug(@PathVariable String slug) {
        return packageRepository.findBySlug(slug).map(this::toPackageResponse).orElse(null);
    }

    private ServiceResponse toServiceResponse(Service service) {
        return new ServiceResponse(service.getId().toString(), service.getName(), service.getSlug(), service.getDescription());
    }

    private PackageResponse toPackageResponse(Package pkg) {
        return new PackageResponse(pkg.getId().toString(), pkg.getName(), pkg.getSlug(), pkg.getDescription(), pkg.getPrice());
    }
}
