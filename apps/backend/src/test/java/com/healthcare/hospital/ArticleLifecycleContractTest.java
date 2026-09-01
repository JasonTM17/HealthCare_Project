package com.healthcare.hospital;

import com.healthcare.exception.BusinessException;
import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.hospital.dto.ArticleRequest;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.service.AdminArticleService;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Contract-level regression coverage for the admin article state machine.
 *
 * This test deliberately uses a repository double so it can run without
 * Docker/PostgreSQL. The live HTTP lifecycle remains a separate runtime gate.
 */
class ArticleLifecycleContractTest {

    @Test
    void namespacedFixtureCanDraftPublishEditUnpublishAndDeleteExactlyOneRecord() {
        ArticleRepository repository = mock(ArticleRepository.class);
        Map<String, Article> records = new HashMap<>();
        when(repository.findBySlug(anyString()))
            .thenAnswer(invocation -> Optional.ofNullable(records.get(invocation.getArgument(0))));
        when(repository.saveAndFlush(any(Article.class)))
            .thenAnswer(invocation -> {
                Article article = invocation.getArgument(0);
                records.put(article.getSlug(), article);
                return article;
            });

        AdminArticleService service = new AdminArticleService(repository);
        String fixtureSlug = "ak-audit-fixture-unit-20260901";

        Article draft = service.create(new ArticleRequest(
            "AK audit fixture", fixtureSlug, "Synthetic summary", "Synthetic body", false));
        assertThat(draft.isActive()).isFalse();
        assertThat(draft.getPublishedAt()).isNull();
        assertThat(records).containsKey(fixtureSlug);

        Article published = service.update(fixtureSlug, new ArticleRequest(
            "AK audit fixture", fixtureSlug, "Synthetic summary", "Synthetic body", true));
        assertThat(published.isActive()).isTrue();
        assertThat(published.getPublishedAt()).isNotNull();

        Article edited = service.update(fixtureSlug, new ArticleRequest(
            "AK audit fixture edited", fixtureSlug, "Edited synthetic summary", "Edited synthetic body", true));
        assertThat(edited.getTitle()).isEqualTo("AK audit fixture edited");
        assertThat(edited.getSummary()).isEqualTo("Edited synthetic summary");
        assertThat(edited.getBody()).isEqualTo("Edited synthetic body");
        assertThat(edited.getPublishedAt()).isNotNull();

        Article unpublished = service.update(fixtureSlug, new ArticleRequest(
            "AK audit fixture edited", fixtureSlug, "Edited synthetic summary", "Edited synthetic body", false));
        assertThat(unpublished.isActive()).isFalse();
        assertThat(unpublished.getPublishedAt()).isNull();

        service.delete(fixtureSlug);
        verify(repository).delete(unpublished);
    }

    @Test
    void rejectsDuplicateSlugAndStaleVersionWithStableConflictDetails() {
        ArticleRepository repository = mock(ArticleRepository.class);
        Article existing = new Article();
        existing.setSlug("ak-audit-fixture-conflict");
        existing.setVersion(7L);
        when(repository.findBySlug("ak-audit-fixture-conflict")).thenReturn(Optional.of(existing));

        AdminArticleService service = new AdminArticleService(repository);
        assertThatThrownBy(() -> service.create(new ArticleRequest(
            "Duplicate fixture", "ak-audit-fixture-conflict", "Summary", "Body", false)))
            .isInstanceOf(DuplicateResourceException.class)
            .satisfies(error -> {
                BusinessException conflict = (BusinessException) error;
                assertThat(conflict.getStatus()).isEqualTo(409);
            });

        assertThatThrownBy(() -> service.update("ak-audit-fixture-conflict", requestWithVersion(6L)))
            .isInstanceOf(BusinessException.class)
            .satisfies(error -> {
                BusinessException conflict = (BusinessException) error;
                assertThat(conflict.getStatus()).isEqualTo(409);
                assertThat(conflict.getCode()).isEqualTo("AI_CONTENT_REVISION_STALE");
            });
    }

    private static ArticleRequest requestWithVersion(long version) {
        return new ArticleRequest(
            "Stale fixture",
            "ak-audit-fixture-conflict",
            "Synthetic summary",
            "Synthetic body",
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            version,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            null,
            false,
            true
        );
    }
}
