package com.healthcare.hospital.service;

import com.healthcare.ai.service.AiClinicalContentRevisionService;
import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.hospital.dto.ServiceRequest;
import com.healthcare.hospital.entity.MedicalService;
import com.healthcare.hospital.repository.ServiceRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AdminServiceService {

    private final ServiceRepository serviceRepository;
    private final AiClinicalContentRevisionService revisionService;

    public AdminServiceService(ServiceRepository serviceRepository) {
        this(serviceRepository, null);
    }

    @Autowired
    public AdminServiceService(
            ServiceRepository serviceRepository,
            AiClinicalContentRevisionService revisionService) {
        this.serviceRepository = serviceRepository;
        this.revisionService = revisionService;
    }

    @Transactional(readOnly = true)
    public Page<MedicalService> list(Pageable pageable) {
        return serviceRepository.findAll(pageable);
    }

    @Transactional
    public MedicalService create(ServiceRequest request) {
        if (serviceRepository.findBySlug(request.slug()).isPresent()) {
            throw new DuplicateResourceException("Service slug already exists: " + request.slug());
        }
        MedicalService service = new MedicalService();
        service.setName(request.name());
        service.setSlug(request.slug());
        service.setDescription(request.description());
        service.setActive(request.active());
        return serviceRepository.save(service);
    }

    @Transactional
    public MedicalService update(String slug, ServiceRequest request) {
        MedicalService service = serviceRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Service not found: " + slug));
        if (!slug.equals(request.slug()) && serviceRepository.findBySlug(request.slug()).isPresent()) {
            throw new DuplicateResourceException("Service slug already exists: " + request.slug());
        }
        service.setName(request.name());
        service.setSlug(request.slug());
        service.setDescription(request.description());
        service.setActive(request.active());
        return serviceRepository.save(service);
    }

    @Transactional
    public void delete(String slug) {
        MedicalService service = serviceRepository.findBySlug(slug)
            .orElseThrow(() -> new com.healthcare.exception.ResourceNotFoundException("Service not found: " + slug));
        if (revisionService != null) revisionService.recordServiceDeletion(service, null);
        serviceRepository.delete(service);
    }
}
