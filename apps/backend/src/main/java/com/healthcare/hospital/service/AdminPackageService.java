package com.healthcare.hospital.service;

import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.hospital.dto.PackageRequest;
import com.healthcare.hospital.entity.Package;
import com.healthcare.hospital.repository.PackageRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminPackageService {

    private final PackageRepository packageRepository;

    public AdminPackageService(PackageRepository packageRepository) {
        this.packageRepository = packageRepository;
    }

    @Transactional(readOnly = true)
    public Page<Package> list(Pageable pageable) {
        return packageRepository.findAll(pageable);
    }

    @Transactional
    public Package create(PackageRequest request) {
        if (packageRepository.findBySlug(request.slug()).isPresent()) {
            throw new DuplicateResourceException("Package slug already exists: " + request.slug());
        }
        Package pkg = new Package();
        pkg.setName(request.name());
        pkg.setSlug(request.slug());
        pkg.setDescription(request.description());
        pkg.setPrice(request.price());
        pkg.setActive(request.active());
        return packageRepository.save(pkg);
    }

    @Transactional
    public Package update(String slug, PackageRequest request) {
        Package pkg = packageRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Package not found: " + slug));
        if (!slug.equals(request.slug()) && packageRepository.findBySlug(request.slug()).isPresent()) {
            throw new DuplicateResourceException("Package slug already exists: " + request.slug());
        }
        pkg.setName(request.name());
        pkg.setSlug(request.slug());
        pkg.setDescription(request.description());
        pkg.setPrice(request.price());
        pkg.setActive(request.active());
        return packageRepository.save(pkg);
    }

    @Transactional
    public void delete(String slug) {
        Package pkg = packageRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Package not found: " + slug));
        packageRepository.delete(pkg);
    }
}
