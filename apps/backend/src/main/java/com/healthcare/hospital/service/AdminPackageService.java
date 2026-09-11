package com.healthcare.hospital.service;

import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.hospital.dto.PackageRequest;
import com.healthcare.hospital.dto.CatalogOrderRequest;
import com.healthcare.exception.BusinessException;
import com.healthcare.exception.ErrorCodes;
import com.healthcare.hospital.entity.Package;
import com.healthcare.hospital.repository.PackageRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;

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
        packageRepository.lockCatalogOrder();
        if (packageRepository.findBySlug(request.slug()).isPresent()) {
            throw new DuplicateResourceException("Package slug already exists: " + request.slug());
        }
        Package pkg = new Package();
        pkg.setName(request.name());
        pkg.setSlug(request.slug());
        pkg.setDescription(request.description());
        pkg.setPrice(request.price());
        pkg.setActive(request.active());
        pkg.setDisplayOrder(packageRepository.findMaxDisplayOrder() + 1);
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
        packageRepository.lockCatalogOrder();
        Package pkg = packageRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Package not found: " + slug));
        packageRepository.delete(pkg);
    }

    @Transactional
    public List<Package> reorder(CatalogOrderRequest request) {
        packageRepository.lockCatalogOrder();
        List<Package> current = packageRepository.findAllInDisplayOrder();
        Map<UUID, Long> versions = current.stream().collect(java.util.stream.Collectors.toMap(Package::getId, Package::getVersion));
        if (request.items().size() != versions.size()) conflict();
        HashSet<UUID> seen = new HashSet<>();
        Map<UUID, Package> byId = current.stream().collect(java.util.stream.Collectors.toMap(Package::getId, value -> value));
        for (int index = 0; index < request.items().size(); index++) {
            CatalogOrderRequest.Item item = request.items().get(index);
            Long version = versions.get(item.id());
            if (!seen.add(item.id()) || version == null || !version.equals(item.version())) conflict();
            byId.get(item.id()).setDisplayOrder(index);
        }
        packageRepository.flush();
        return packageRepository.findAllInDisplayOrder();
    }

    private void conflict() {
        throw new BusinessException(409, ErrorCodes.CONFLICT, "Thứ tự danh mục đã thay đổi trên máy chủ. Vui lòng tải lại trang rồi lưu lại.");
    }
}
