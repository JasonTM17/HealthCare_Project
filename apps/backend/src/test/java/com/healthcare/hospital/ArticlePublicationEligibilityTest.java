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
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ArticlePublicationEligibilityTest {

    @Test
    void publicListUsesCurrentTimeAsPublicationCutoff() {
        ArticleRepository repository = mock(ArticleRepository.class);
        Pageable pageable = PageRequest.of(0, 10);
        // The service normalizes the incoming pageable (clamped page window and
        // whitelisted default sort), so the stub matches any Pageable instance.
        when(repository.findByContentKindAndActiveTrueAndReviewStatusAndPublishedAtLessThanEqualOrderByPublishedAtDesc(
            eq("GENERAL"), eq("APPROVED"), any(OffsetDateTime.class), any(Pageable.class)))
            .thenReturn(Page.empty(pageable));
        OffsetDateTime before = OffsetDateTime.now();

        new ArticleService(repository).listPublished(pageable);

        OffsetDateTime after = OffsetDateTime.now();
        ArgumentCaptor<OffsetDateTime> cutoff = ArgumentCaptor.forClass(OffsetDateTime.class);
        verify(repository).findByContentKindAndActiveTrueAndReviewStatusAndPublishedAtLessThanEqualOrderByPublishedAtDesc(
            eq("GENERAL"), eq("APPROVED"), cutoff.capture(), any(Pageable.class));
        assertThat(cutoff.getValue()).isBetween(before, after);
    }

    @Test
    void publicListForwardsNormalizedContentKindWithTheReviewGate() {
        ArticleRepository repository = mock(ArticleRepository.class);
        Pageable pageable = PageRequest.of(0, 10);
        when(repository.findByContentKindAndActiveTrueAndReviewStatusAndPublishedAtLessThanEqualOrderByPublishedAtDesc(
            eq("GENERAL"), eq("APPROVED"), any(OffsetDateTime.class), any(Pageable.class)))
            .thenReturn(Page.empty(pageable));

        new ArticleService(repository).listPublished("  general  ", pageable);

        verify(repository).findByContentKindAndActiveTrueAndReviewStatusAndPublishedAtLessThanEqualOrderByPublishedAtDesc(
            eq("GENERAL"), eq("APPROVED"), any(OffsetDateTime.class), any(Pageable.class));
    }

    @Test
    void diseaseGuideListIsRoutedToTheClinicallyEligibleNativeQuery() {
        ArticleRepository repository = mock(ArticleRepository.class);
        Pageable pageable = PageRequest.of(0, 10);
        when(repository.findClinicallyEligibleDiseaseGuides(any(Pageable.class)))
            .thenReturn(Page.empty(pageable));

        new ArticleService(repository).listPublished("DISEASE_GUIDE", pageable);

        verify(repository).findClinicallyEligibleDiseaseGuides(any(Pageable.class));
        verify(repository, never())
            .findByContentKindAndActiveTrueAndReviewStatusAndPublishedAtLessThanEqualOrderByPublishedAtDesc(
                any(String.class), any(String.class), any(OffsetDateTime.class), any(Pageable.class));
    }

    @Test
    void unknownContentKindIsRejectedBeforeAnyQuery() {
        ArticleRepository repository = mock(ArticleRepository.class);

        assertThatThrownBy(() -> new ArticleService(repository)
            .listPublished("MARKETING", PageRequest.of(0, 10)))
            .isInstanceOf(com.healthcare.exception.BusinessException.class);

        verifyNoInteractions(repository);
    }

    @Test
    void publicDetailExcludesArticlesPublishedAfterCurrentTime() {
        ArticleRepository repository = mock(ArticleRepository.class);
        when(repository.findBySlugAndActiveTrueAndReviewStatusAndPublishedAtLessThanEqual(
            eq("future-article"), eq("APPROVED"), any(OffsetDateTime.class)))
            .thenReturn(Optional.empty());
        OffsetDateTime before = OffsetDateTime.now();

        assertThatThrownBy(() -> new ArticleService(repository).getBySlug("future-article"))
            .isInstanceOf(ResourceNotFoundException.class);

        OffsetDateTime after = OffsetDateTime.now();
        ArgumentCaptor<OffsetDateTime> cutoff = ArgumentCaptor.forClass(OffsetDateTime.class);
        verify(repository).findBySlugAndActiveTrueAndReviewStatusAndPublishedAtLessThanEqual(
            eq("future-article"), eq("APPROVED"), cutoff.capture());
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
