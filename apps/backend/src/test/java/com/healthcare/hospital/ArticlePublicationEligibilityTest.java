package com.healthcare.hospital;

import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.service.ArticleService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;

import java.time.OffsetDateTime;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ArticlePublicationEligibilityTest {

    @Test
    void publicListUsesCurrentTimeAsPublicationCutoff() {
        ArticleRepository repository = mock(ArticleRepository.class);
        Pageable pageable = PageRequest.of(0, 10);
        when(repository.findByContentKindAndActiveTrueAndPublishedAtLessThanEqualOrderByPublishedAtDesc(
            eq("GENERAL"), any(OffsetDateTime.class), eq(pageable)))
            .thenReturn(Page.empty(pageable));
        OffsetDateTime before = OffsetDateTime.now();

        new ArticleService(repository).listPublished(pageable);

        OffsetDateTime after = OffsetDateTime.now();
        ArgumentCaptor<OffsetDateTime> cutoff = ArgumentCaptor.forClass(OffsetDateTime.class);
        verify(repository).findByContentKindAndActiveTrueAndPublishedAtLessThanEqualOrderByPublishedAtDesc(
            eq("GENERAL"), cutoff.capture(), eq(pageable));
        assertThat(cutoff.getValue()).isBetween(before, after);
    }

    @Test
    void publicDetailExcludesArticlesPublishedAfterCurrentTime() {
        ArticleRepository repository = mock(ArticleRepository.class);
        when(repository.findBySlugAndActiveTrueAndPublishedAtLessThanEqual(
            eq("future-article"), any(OffsetDateTime.class)))
            .thenReturn(Optional.empty());
        OffsetDateTime before = OffsetDateTime.now();

        assertThatThrownBy(() -> new ArticleService(repository).getBySlug("future-article"))
            .isInstanceOf(ResourceNotFoundException.class);

        OffsetDateTime after = OffsetDateTime.now();
        ArgumentCaptor<OffsetDateTime> cutoff = ArgumentCaptor.forClass(OffsetDateTime.class);
        verify(repository).findBySlugAndActiveTrueAndPublishedAtLessThanEqual(
            eq("future-article"), cutoff.capture());
        assertThat(cutoff.getValue()).isBetween(before, after);
    }

    @Test
    void diseaseGuideNativeQueriesAlsoRejectFuturePublicationTimestamps() throws Exception {
        Query listQuery = ArticleRepository.class
            .getMethod("findClinicallyEligibleDiseaseGuides", Pageable.class)
            .getAnnotation(Query.class);
        Query detailQuery = ArticleRepository.class
            .getMethod("findClinicallyEligibleDiseaseGuideBySlug", String.class)
            .getAnnotation(Query.class);

        assertThat(listQuery.value()).contains("a.published_at <= CURRENT_TIMESTAMP");
        assertThat(listQuery.countQuery()).contains("a.published_at <= CURRENT_TIMESTAMP");
        assertThat(detailQuery.value()).contains("a.published_at <= CURRENT_TIMESTAMP");
        assertThat(listQuery.value()).doesNotContain("a.published_at IS NOT NULL");
        assertThat(detailQuery.value()).doesNotContain("a.published_at IS NOT NULL");
    }
}
