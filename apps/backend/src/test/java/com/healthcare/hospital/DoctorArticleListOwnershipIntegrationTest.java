package com.healthcare.hospital;

import com.healthcare.AbstractIntegrationTest;
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

/**
 * Doctor-portal list ownership against PostgreSQL, where the leak actually
 * lived: {@code findByAuthorNames} matched the free-text
 * {@code articles.author_name}, so the rows of two doctors that share a display
 * name were readable by both, and a renamed doctor lost their own list while
 * PUT/DELETE kept working.
 *
 * <p>The fix routes an identified doctor through {@code author_doctor_id} (the
 * V93 authority every doctor write already records). The legacy name query is
 * exercised here too, deliberately, to document what it returns and why it can
 * no longer be the read path for a doctor that has an identity.
 */
@Transactional
class DoctorArticleListOwnershipIntegrationTest extends AbstractIntegrationTest {

    private static final String SHARED_DISPLAY_NAME = "TS.BS Nguyễn Minh Khôi";

    @Autowired private ArticleService articleService;

    private Doctor firstDoctor;
    private Doctor secondDoctor;

    @BeforeEach
    void seedTwoDoctorsThatShareADisplayName() {
        firstDoctor = doctor("author-list-first");
        secondDoctor = doctor("author-list-second");
        article("bai-viet-cua-khoi-thu-nhat", firstDoctor.getId());
        article("bai-viet-cua-khoi-thu-hai", secondDoctor.getId());
        // A row the V93 backfill could not bind: the name is ambiguous, so
        // author_doctor_id stayed NULL on purpose.
        article("bai-viet-truoc-backfill", null);
        articleRepository.flush();
    }

    @Test
    @DisplayName("An identified doctor lists only their own articles, never a same-name colleague's")
    void doctorIdScopedListIsolatesSameNameDoctors() {
        assertThat(slugsOf(articleService.listByAuthorDoctorId(firstDoctor.getId(), null, PageRequest.of(0, 20))))
            .containsExactly("bai-viet-cua-khoi-thu-nhat");
        assertThat(slugsOf(articleService.listByAuthorDoctorId(secondDoctor.getId(), null, PageRequest.of(0, 20))))
            .containsExactly("bai-viet-cua-khoi-thu-hai");
    }

    @Test
    @DisplayName("The content-kind variant keeps the same doctor-id isolation")
    void doctorIdScopedListRespectsContentKind() {
        Article guide = article("huong-dan-chung-thuong", firstDoctor.getId());
        guide.setContentKind("DISEASE_GUIDE");
        articleRepository.saveAndFlush(guide);

        assertThat(slugsOf(articleService.listByAuthorDoctorId(
            firstDoctor.getId(), "general", PageRequest.of(0, 20))))
            .containsExactly("bai-viet-cua-khoi-thu-nhat");
        assertThat(slugsOf(articleService.listByAuthorDoctorId(
            secondDoctor.getId(), "DISEASE_GUIDE", PageRequest.of(0, 20))))
            .isEmpty();
    }

    @Test
    @DisplayName("The retired name query really did merge the two doctors' rows")
    void legacyNameQueryLeaksAcrossSameNameDoctors() {
        // The exact arguments the pre-fix controller built: full name, the
        // account display name, and the academic-title-stripped name.
        Page<ArticleResponse> byName = articleService.listByAuthor(
            SHARED_DISPLAY_NAME, SHARED_DISPLAY_NAME, "Nguyễn Minh Khôi", null, PageRequest.of(0, 20));

        // Kept as the counter-example: this is the read path the doctor portal
        // must not use once the caller has a doctor identity.
        assertThat(slugsOf(byName)).containsExactlyInAnyOrder(
            "bai-viet-cua-khoi-thu-nhat", "bai-viet-cua-khoi-thu-hai", "bai-viet-truoc-backfill");
    }

    @Test
    @DisplayName("A renamed doctor keeps their list; the name query would return nothing")
    void renamedDoctorStillSeesOwnArticlesById() {
        Doctor renamed = doctor("author-list-renamed");
        renamed.setFullName("Bác sĩ Đã Đổi Tên");
        doctorRepository.saveAndFlush(renamed);
        article("bai-viet-sau-khi-doi-ten", renamed.getId());
        articleRepository.flush();

        assertThat(slugsOf(articleService.listByAuthorDoctorId(renamed.getId(), null, PageRequest.of(0, 20))))
            .containsExactly("bai-viet-sau-khi-doi-ten");
        assertThat(slugsOf(articleService.listByAuthor(
            "Bác sĩ Đã Đổi Tên", "Bác sĩ Đã Đổi Tên", "Đã Đổi Tên", null, PageRequest.of(0, 20)))).isEmpty();
    }

    private List<String> slugsOf(Page<ArticleResponse> page) {
        return page.getContent().stream().map(ArticleResponse::slug).toList();
    }

    private Doctor doctor(String slug) {
        Doctor doctor = new Doctor();
        doctor.setSlug(slug + "-" + UUID.randomUUID().toString().substring(0, 8));
        doctor.setFullName(SHARED_DISPLAY_NAME);
        doctor.setActive(true);
        return doctorRepository.saveAndFlush(doctor);
    }

    private Article article(String slug, UUID authorDoctorId) {
        Article article = new Article();
        article.setTitle("Bài viết " + slug);
        article.setSlug(slug);
        article.setSummary("Tóm tắt " + slug);
        article.setBody("Nội dung " + slug);
        article.setCategory("Sức khỏe");
        article.setReadingMinutes(4);
        article.setAuthorName(SHARED_DISPLAY_NAME);
        article.setAuthorDoctorId(authorDoctorId);
        article.setPublishedAt(OffsetDateTime.now().minusDays(1));
        article.setActive(true);
        return articleRepository.save(article);
    }
}
