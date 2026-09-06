package com.healthcare.common;

import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SafePageRequestsTest {

    private static final Set<String> ALLOWED = Set.of("id", "name");

    @Test
    void oversizedPageIsRejected() {
        Pageable raw = PageRequest.of(0, 2000);

        assertThatThrownBy(() -> SafePageRequests.normalize(raw, Sort.unsorted(), ALLOWED))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("400");
    }

    @Test
    void unknownSortPropertyIsRejectedInsteadOf500() {
        Pageable raw = PageRequest.of(0, 20, Sort.by("body").descending());

        assertThatThrownBy(() -> SafePageRequests.normalize(raw, Sort.unsorted(), ALLOWED))
            .isInstanceOf(ResponseStatusException.class)
            .hasMessageContaining("unsupported sort property: body");
    }

    @Test
    void unsortedRequestFallsBackToDefaultSort() {
        Pageable raw = PageRequest.of(0, 20);
        Sort defaultSort = Sort.by(Sort.Direction.DESC, "name");

        Pageable normalized = SafePageRequests.normalize(raw, defaultSort, ALLOWED);

        assertThat(normalized.getSort()).isEqualTo(defaultSort);
        assertThat(normalized.getPageSize()).isEqualTo(20);
    }

    @Test
    void whitelistedSortIsPreserved() {
        Pageable raw = PageRequest.of(0, 20, Sort.by("name").ascending());

        Pageable normalized = SafePageRequests.normalize(raw, Sort.unsorted(), ALLOWED);

        assertThat(normalized.getSort()).isEqualTo(Sort.by("name").ascending());
    }
}
