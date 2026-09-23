package com.healthcare.hospital;

import com.healthcare.TestcontainersIntegrationTest;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.service.ArticlePublicationSweeper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * PostgreSQL-backed proof that the scheduled-publish sweep exists and works.
 *
 * <p>Before this gate, an article with a past {@code scheduledPublishAt} and
 * a null {@code publishedAt} stayed invisible forever: nothing promoted the
 * schedule. The sweep's contract is asymmetric on purpose — an APPROVED due
 * row is published, while a PENDING/REJECTED row or a not-yet-due row is left
 * exactly where it was, because the public catalog must never gain an
 * unreviewed article from a stray schedule.
 *
 * <p>The sweep interval is pinned far into the future so only the immediate
 * start-up tick and this test's direct call run: the promoted row can never
 * be consumed by a background tick racing the assertions.
 */
@TestPropertySource(properties = "app.articles.publish-sweep-ms=3600000")
class ArticlePublicationSweeperIntegrationTest extends TestcontainersIntegrationTest {

    @Autowired
    private ArticlePublicationSweeper sweeper;

    private Article fixture(String name, String reviewStatus, OffsetDateTime scheduledPublishAt) {
        Article article = new Article();
        article.setTitle("Sweep fixture " + name);
        article.setSlug("sweep-" + name + "-" + UUID.randomUUID());
        article.setSummary("Synthetic summary without PHI");
        article.setBody("Synthetic body without PHI");
        article.setActive(true);
        article.setReviewStatus(reviewStatus);
        article.setPublishedAt(null);
        article.setScheduledPublishAt(scheduledPublishAt);
        return article;
    }

    @Test
    void publishesDueApprovedRowsAndLeavesEverythingElseAlone() {
        OffsetDateTime now = OffsetDateTime.now();
        Article due = articleRepository.saveAndFlush(
            fixture("due", "APPROVED", now.minusHours(1)));
        Article pending = articleRepository.saveAndFlush(
            fixture("pending", "PENDING", now.minusHours(1)));
        Article rejected = articleRepository.saveAndFlush(
            fixture("rejected", "REJECTED", now.minusHours(1)));
        Article future = articleRepository.saveAndFlush(
            fixture("future", "APPROVED", now.plusHours(1)));
        List<UUID> ids = List.of(due.getId(), pending.getId(), rejected.getId(), future.getId());

        try {
            int published = sweeper.publishDueScheduledArticles();

            assertThat(published).isEqualTo(1);
            assertThat(articleRepository.findById(due.getId()).orElseThrow().getPublishedAt())
                .as("an approved row whose schedule arrived becomes visible")
                .isNotNull()
                .isBetween(now, OffsetDateTime.now());
            assertThat(articleRepository.findById(pending.getId()).orElseThrow().getPublishedAt())
                .as("a pending submission must never be auto-published")
                .isNull();
            assertThat(articleRepository.findById(rejected.getId()).orElseThrow().getPublishedAt())
                .as("a rejected submission must never be auto-published")
                .isNull();
            assertThat(articleRepository.findById(future.getId()).orElseThrow().getPublishedAt())
                .as("a schedule still in the future must stay unpublished")
                .isNull();
        } finally {
            articleRepository.deleteAllById(ids);
        }
    }

    @Test
    void sweepIsBoundedPerTickAndRepeatsOnTheNextOne() {
        OffsetDateTime past = OffsetDateTime.now().minusHours(1);
        List<Article> due = new java.util.ArrayList<>();
        for (int i = 0; i < 3; i++) {
            due.add(articleRepository.saveAndFlush(fixture("batch-" + i, "APPROVED", past)));
        }
        List<UUID> ids = due.stream().map(Article::getId).toList();
        try {
            // One tick drains the batch (bounded at 100, this is 3); a second
            // tick finds nothing left.
            assertThat(sweeper.publishDueScheduledArticles()).isEqualTo(3);
            assertThat(sweeper.publishDueScheduledArticles()).isZero();
            assertThat(due)
                .allSatisfy(article -> assertThat(
                    articleRepository.findById(article.getId()).orElseThrow().getPublishedAt())
                    .isNotNull());
        } finally {
            articleRepository.deleteAllById(ids);
        }
    }
}
