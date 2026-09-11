package com.healthcare.hospital;

import com.healthcare.exception.BusinessException;
import com.healthcare.hospital.dto.CatalogOrderRequest;
import com.healthcare.hospital.dto.PackageRequest;
import com.healthcare.hospital.entity.Faq;
import com.healthcare.hospital.entity.Package;
import com.healthcare.hospital.repository.FaqRepository;
import com.healthcare.hospital.repository.PackageRepository;
import com.healthcare.hospital.service.AdminFaqService;
import com.healthcare.hospital.service.AdminPackageService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CatalogOrderServiceTest {

    @Mock PackageRepository packages;
    @Mock FaqRepository faqs;

    @Test
    void packageReorderPersistsContiguousOrderAndReturnsSavedOrder() {
        Package first = packageRow(0, 4L);
        Package second = packageRow(1, 8L);
        List<Package> rows = List.of(first, second);
        when(packages.findAllInDisplayOrder()).thenAnswer(invocation -> rows.stream()
            .sorted(Comparator.comparingInt(Package::getDisplayOrder)).toList());

        List<Package> result = new AdminPackageService(packages).reorder(new CatalogOrderRequest(List.of(
            new CatalogOrderRequest.Item(second.getId(), 8L),
            new CatalogOrderRequest.Item(first.getId(), 4L)
        )));

        assertThat(result).containsExactly(second, first);
        assertThat(second.getDisplayOrder()).isZero();
        assertThat(first.getDisplayOrder()).isEqualTo(1);
        verify(packages).lockCatalogOrder();
        verify(packages).flush();
    }

    @Test
    void packageReorderRejectsStaleVersionBeforeMutatingOrder() {
        Package row = packageRow(0, 3L);
        when(packages.findAllInDisplayOrder()).thenReturn(List.of(row));

        assertThatThrownBy(() -> new AdminPackageService(packages).reorder(new CatalogOrderRequest(List.of(
            new CatalogOrderRequest.Item(row.getId(), 2L)
        )))).isInstanceOf(BusinessException.class)
            .extracting("status").isEqualTo(409);
        assertThat(row.getDisplayOrder()).isZero();
    }

    @Test
    void faqReorderRejectsDuplicateOrIncompleteCollection() {
        Faq first = faqRow(0, 1L);
        Faq second = faqRow(1, 1L);
        when(faqs.findAllInDisplayOrder()).thenReturn(List.of(first, second));

        assertThatThrownBy(() -> new AdminFaqService(faqs).reorder(new CatalogOrderRequest(List.of(
            new CatalogOrderRequest.Item(first.getId(), 1L),
            new CatalogOrderRequest.Item(first.getId(), 1L)
        )))).isInstanceOf(BusinessException.class)
            .extracting("status").isEqualTo(409);
        assertThat(first.getDisplayOrder()).isZero();
        assertThat(second.getDisplayOrder()).isEqualTo(1);
        verify(faqs, atLeastOnce()).lockCatalogOrder();
    }

    @Test
    void deletesShareTheCatalogLockWithReorder() {
        Package pkg = packageRow(0, 1L);
        when(packages.findBySlug("starter")).thenReturn(java.util.Optional.of(pkg));
        Faq faq = faqRow(0, 1L);
        when(faqs.findById(faq.getId())).thenReturn(java.util.Optional.of(faq));

        new AdminPackageService(packages).delete("starter");
        new AdminFaqService(faqs).delete(faq.getId());

        verify(packages).lockCatalogOrder();
        verify(faqs).lockCatalogOrder();
    }

    @Test
    void packageCreateAppendsAfterHighestOrderWhenADeletedRowLeftAGap() {
        when(packages.findBySlug("new-package")).thenReturn(java.util.Optional.empty());
        when(packages.findMaxDisplayOrder()).thenReturn(2);
        when(packages.save(any(Package.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Package created = new AdminPackageService(packages).create(new PackageRequest(
            "New", "new-package", "Description", BigDecimal.TEN, true));

        assertThat(created.getDisplayOrder()).isEqualTo(3);
        verify(packages).lockCatalogOrder();
    }

    private Package packageRow(int order, long version) {
        Package row = new Package();
        row.setId(UUID.randomUUID());
        row.setDisplayOrder(order);
        row.setVersion(version);
        return row;
    }

    private Faq faqRow(int order, long version) {
        Faq row = new Faq();
        row.setId(UUID.randomUUID());
        row.setDisplayOrder(order);
        row.setVersion(version);
        return row;
    }
}
