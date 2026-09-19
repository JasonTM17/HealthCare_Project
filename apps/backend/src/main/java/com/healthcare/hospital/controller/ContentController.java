package com.healthcare.hospital.controller;

import com.healthcare.common.SafePageRequests;
import com.healthcare.hospital.dto.PackageResponse;
import com.healthcare.hospital.dto.ServiceResponse;
import com.healthcare.hospital.entity.Package;
import com.healthcare.hospital.entity.MedicalService;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.repository.ServiceRepository;
import com.healthcare.exception.ResourceNotFoundException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Set;

@Tag(name = "Public Catalog", description = "Danh mục cơ sở, chuyên khoa, bác sĩ, gói khám, dịch vụ, bài viết")
@RestController
@RequestMapping("/api/v1/hospital")
public class ContentController {

    private static final Set<String> PACKAGE_SORT_PROPERTIES = Set.of("id", "name", "slug", "price", "displayOrder");
    private static final Set<String> SERVICE_SORT_PROPERTIES = Set.of("id", "name", "slug");

    private final ServiceRepository serviceRepository;
    private final PackageRepository packageRepository;

    public ContentController(ServiceRepository serviceRepository, PackageRepository packageRepository) {
        this.serviceRepository = serviceRepository;
        this.packageRepository = packageRepository;
    }

    @Operation(summary = "Lấy danh sách dịch vụ y tế công khai", description = "Danh sách dịch vụ y tế đang hoạt động kèm phân trang")
    @GetMapping("/services")
    public Page<ServiceResponse> listServices(@PageableDefault(size = 20) Pageable pageable) {
        return serviceRepository.findByActiveTrue(safeServicePageable(pageable)).map(this::toServiceResponse);
    }

    @Operation(summary = "Xem chi tiết dịch vụ y tế theo slug", description = "Truy xuất thông tin chi tiết dịch vụ y tế qua đường dẫn thân thiện (slug)")
    @GetMapping("/services/{slug}")
    public ServiceResponse getServiceBySlug(@PathVariable String slug) {
        return serviceRepository.findBySlugAndActiveTrue(slug)
            .map(this::toServiceResponse)
            .orElseThrow(() -> new ResourceNotFoundException("Service not found"));
    }

    @Operation(summary = "Lấy danh sách gói khám sức khỏe công khai", description = "Danh sách các gói khám sức khỏe tổng quát, chuyên sâu kèm giá và quy trình")
    @GetMapping("/packages")
    public Page<PackageResponse> listPackages(@PageableDefault(size = 20) Pageable pageable) {
        return packageRepository.findByActiveTrue(safePackagePageable(pageable)).map(this::toPackageResponse);
    }

    private Pageable safeServicePageable(Pageable pageable) {
        return SafePageRequests.normalize(pageable, Sort.by(Sort.Order.asc("name"), Sort.Order.asc("id")), SERVICE_SORT_PROPERTIES);
    }

    private Pageable safePackagePageable(Pageable pageable) {
        return SafePageRequests.normalize(pageable, Sort.by(Sort.Order.asc("displayOrder"), Sort.Order.asc("id")), PACKAGE_SORT_PROPERTIES);
    }

    @Operation(summary = "Xem chi tiết gói khám theo slug", description = "Truy xuất danh mục xét nghiệm, chỉ định và lưu ý chuẩn bị trước khi khám của gói")
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
