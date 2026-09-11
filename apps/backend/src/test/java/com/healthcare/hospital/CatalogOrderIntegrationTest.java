package com.healthcare.hospital;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.exception.BusinessException;
import com.healthcare.hospital.dto.CatalogOrderRequest;
import com.healthcare.hospital.dto.PackageRequest;
import com.healthcare.hospital.entity.Package;
import com.healthcare.hospital.service.AdminPackageService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CatalogOrderIntegrationTest extends AbstractIntegrationTest {

    @Autowired AdminPackageService packageService;

    @Test
    void migrationLockVersionAndPersistedOrderWorkTogether() {
        packageService.create(request("Gói A", "goi-a"));
        packageService.create(request("Gói B", "goi-b"));
        List<Package> before = packageRepository.findAllInDisplayOrder();

        List<Package> saved = packageService.reorder(new CatalogOrderRequest(List.of(
            new CatalogOrderRequest.Item(before.get(1).getId(), before.get(1).getVersion()),
            new CatalogOrderRequest.Item(before.get(0).getId(), before.get(0).getVersion())
        )));

        assertThat(saved).extracting(Package::getSlug).containsExactly("goi-b", "goi-a");
        assertThat(packageRepository.findAllInDisplayOrder())
            .extracting(Package::getSlug).containsExactly("goi-b", "goi-a");
        assertThat(packageRepository.findAllInDisplayOrder())
            .extracting(Package::getDisplayOrder).containsExactly(0, 1);

        assertThatThrownBy(() -> packageService.reorder(new CatalogOrderRequest(List.of(
            new CatalogOrderRequest.Item(before.get(1).getId(), before.get(1).getVersion()),
            new CatalogOrderRequest.Item(before.get(0).getId(), before.get(0).getVersion())
        )))).isInstanceOf(BusinessException.class)
            .extracting("status").isEqualTo(409);
    }

    private PackageRequest request(String name, String slug) {
        return new PackageRequest(name, slug, "Gói kiểm thử", BigDecimal.valueOf(100_000), true);
    }
}
