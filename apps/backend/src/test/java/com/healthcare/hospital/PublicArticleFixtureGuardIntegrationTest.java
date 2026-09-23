package com.healthcare.hospital;

import com.healthcare.AbstractIntegrationTest;
import com.healthcare.exception.ResourceNotFoundException;
import com.healthcare.hospital.dto.ArticleResponse;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.entity.Doctor;
import com.healthcare.hospital.service.ArticleService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Structural fixture guard (public-content hygiene, Kongming §2 / Advisor WS2):
 * every public article read in {@code ArticleRepository} carries
 * {@code slug NOT LIKE 'e2e-%'}, so a Playwright fixture that is still
 * published in some environment can never surface on the hospital's public
 * pages. The admin and doctor-portal reads intentionally keep the fixtures —
 * authors must still see and clean up their own rows.
 *
 * <p>PostgreSQL-backed on purpose: the guard lives in JPQL/native query text,
 * which only the real dialect executes.
 */
@Transactional
class PublicArticleFixtureGuardIntegrationTest extends AbstractIntegrationTest {

    private static final String AUTHOR_NAME = "BS. Công Khai Fixture Guard";

    @Autowired private ArticleService articleService;

    private Doctor author;
    private String fixtureSlug;
    private String publicSlug;

    @BeforeEach
    void seedOneFixtureAndOneRealArticleForTheSameAuthor() {
        String suffix = UUID.randomUUID().toString().substring(0, 8);
        author = new Doctor();
        author.setSlug("fixture-guard-doctor-" + suffix);
        author.setFullName(AUTHOR_NAME);
        author.setActive(true);
        doctorRepository.saveAndFlush(author);

        fixtureSlug = "e2e-public-guard-fixture-" + suffix;
        publicSlug = "bai-viet-public-guard-" + suffix;
        publishedArticle(fixtureSlug);
        publishedArticle(publicSlug);
        articleRepository.flush();
    }

    @Test
    @DisplayName("The public GENERAL list query hides the e2e fixture and keeps the real article")
    void publicListQueryExcludesE2eSlug() {
        List<String> slugs = entitySlugsOf(articleRepository
            .findByContentKindAndActiveTrueAndReviewStatusAndPublishedAtLessThanEqualOrderByPublishedAtDesc(
                "GENERAL", "APPROVED", OffsetDateTime.now(), PageRequest.of(0, 100)));

        assertThat(slugs).contains(publicSlug);
        assertThat(slugs).doesNotContain(fixtureSlug);
    }

    @Test
    @DisplayName("Both public detail finders reject the e2e fixture slug")
    void publicDetailQueriesExcludeE2eSlug() {
        assertThat(articleRepository.findBySlugAndActiveTrueAndReviewStatusAndPublishedAtLessThanEqual(
            fixtureSlug, "APPROVED", OffsetDateTime.now())).isEmpty();
        assertThat(articleRepository.findBySlugAndActiveTrueAndReviewStatusAndPublishedAtLessThanEqual(
            publicSlug, "APPROVED", OffsetDateTime.now())).isPresent();
        assertThat(articleRepository.findBySlugAndActiveTrueAndPublishedAtLessThanEqual(
            fixtureSlug, OffsetDateTime.now())).isEmpty();
    }

    @Test
    @DisplayName("The unfiltered public list variant also excludes the fixture")
    void genericPublicListQueryExcludesE2eSlug() {
        List<String> slugs = entitySlugsOf(articleRepository
            .findByActiveTrueAndPublishedAtLessThanEqualOrderByPublishedAtDesc(
                OffsetDateTime.now(), PageRequest.of(0, 100)));

        assertThat(slugs).contains(publicSlug);
        assertThat(slugs).doesNotContain(fixtureSlug);
    }

    @Test
    @DisplayName("ArticleService public endpoints 404 the fixture and still list the real article")
    void publicServiceEndpointsHideTheFixture() {
        assertThat(slugsOf(articleService.listPublished(PageRequest.of(0, 100))))
            .contains(publicSlug)
            .doesNotContain(fixtureSlug);
        assertThatThrownBy(() -> articleService.getBySlug(fixtureSlug))
            .isInstanceOf(ResourceNotFoundException.class);
        assertThat(articleService.getBySlug(publicSlug).slug()).isEqualTo(publicSlug);
    }

    @Test
    @DisplayName("Admin/doctor reads keep the fixture: findBySlug, doctor-id list, legacy name list")
    void privilegedQueriesStillSeeTheFixture() {
        assertThat(articleRepository.findBySlug(fixtureSlug)).isPresent();
        assertThat(entitySlugsOf(articleRepository.findByAuthorDoctorId(
            author.getId(), PageRequest.of(0, 100)))).contains(fixtureSlug, publicSlug);
        // The legacy name query binds all three parameters non-null: a raw
        // NULL bind is typed as bytea by PostgreSQL and fails lower(?), an
        // existing quirk of findByAuthorNames unrelated to this guard.
        assertThat(slugsOf(articleService.listByAuthor(
            AUTHOR_NAME, AUTHOR_NAME, AUTHOR_NAME, null, PageRequest.of(0, 100))))
            .contains(fixtureSlug, publicSlug);
    }

    private List<String> entitySlugsOf(Page<Article> page) {
        return page.getContent().stream().map(Article::getSlug).toList();
    }

    private List<String> slugsOf(Page<ArticleResponse> page) {
        return page.getContent().stream().map(ArticleResponse::slug).toList();
    }

    private Article publishedArticle(String slug) {
        Article article = new Article();
        article.setTitle("Bài viết " + slug);
        article.setSlug(slug);
        article.setSummary("Tóm tắt " + slug);
        article.setBody("Nội dung " + slug);
        article.setCategory("Sức khỏe");
        article.setReadingMinutes(4);
        article.setAuthorName(AUTHOR_NAME);
        article.setAuthorDoctorId(author.getId());
        article.setContentKind("GENERAL");
        article.setReviewStatus("APPROVED");
        article.setPublishedAt(OffsetDateTime.now().minusDays(1));
        article.setActive(true);
        return articleRepository.save(article);
    }
}
