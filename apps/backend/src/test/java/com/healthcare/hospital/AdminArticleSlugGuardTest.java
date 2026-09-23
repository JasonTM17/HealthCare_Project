package com.healthcare.hospital;

import com.healthcare.exception.BusinessException;
import com.healthcare.exception.DuplicateResourceException;
import com.healthcare.hospital.dto.ArticleRequest;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.service.AdminArticleService;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Write-side guards on the article slug and the stored body.
 *
 * <p>Following the sibling article contract suites, these use a repository
 * double and a plain bean-validation factory so they run without
 * Docker/PostgreSQL; the live HTTP path stays a separate runtime gate.
 */
class AdminArticleSlugGuardTest {

    private record Fixture(AdminArticleService service, Map<String, Article> records) {
    }

    private Fixture fixture() {
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
        return new Fixture(new AdminArticleService(repository), records);
    }

    // ── T2: canonical slug shape ─────────────────────────────────────────────

    @Test
    void rejectsNonKebabSlugAndAcceptsTheCanonicalForm() {
        try (ValidatorFactory factory = Validation.buildDefaultValidatorFactory()) {
            Validator validator = factory.getValidator();

            Set<ConstraintViolation<ArticleRequest>> violations = validator.validate(
                new ArticleRequest("Tụt huyết áp", "My Article!", "Tóm tắt", "Nội dung", true));
            assertThat(violations)
                .as("a display title must not become a URL")
                .allSatisfy(violation ->
                    assertThat(violation.getPropertyPath().toString()).isEqualTo("slug"));
            assertThat(violations).isNotEmpty();

            assertThat(validator.validate(
                new ArticleRequest("Tụt huyết áp", "my-article", "Tóm tắt", "Nội dung", true)))
                .as("the shape the editor generates must pass")
                .isEmpty();

            // Round-10 matrix: titles containing " - " used to generate slugs with
            // hyphen runs, which the strict pattern then made permanently uneditable
            // (the doctor edit path re-sends the stored slug).
            assertThat(validator.validate(
                new ArticleRequest("P2 matrix - quy trình", "p2-matrix---quy-trinh", "Tóm tắt", "Nội dung", true)))
                .as("legacy slugs with hyphen runs must stay editable")
                .isEmpty();
        }
    }

    // ── T3: case-insensitive collision ───────────────────────────────────────

    @Test
    void createRejectsACaseVariantOfAnExistingSlugWithTheFamiliarConflict() {
        ArticleRepository repository = mock(ArticleRepository.class);
        Article existing = new Article();
        existing.setId(UUID.randomUUID());
        existing.setSlug("tang-huyet");
        // Exact match finds nothing (the constraint is case-sensitive); the
        // case-insensitive pre-check must be what refuses "Tang-Huyet".
        when(repository.findBySlug("Tang-Huyet")).thenReturn(Optional.empty());
        when(repository.existsBySlugIgnoreCaseAndSlugNot("Tang-Huyet", "Tang-Huyet")).thenReturn(true);

        AdminArticleService service = new AdminArticleService(repository);
        assertThatThrownBy(() -> service.create(new ArticleRequest(
            "Tụt huyết áp", "Tang-Huyet", "Tóm tắt", "Nội dung", false)))
            .isInstanceOf(DuplicateResourceException.class)
            .hasMessage("Article slug already exists: Tang-Huyet")
            .satisfies(thrown -> assertThat(((BusinessException) thrown).getStatus()).isEqualTo(409));

        verify(repository, never()).saveAndFlush(any(Article.class));
    }

    @Test
    void renameCollidingCaselesslyWithAnotherRowIsRejected() {
        ArticleRepository repository = mock(ArticleRepository.class);
        Article own = new Article();
        own.setId(UUID.randomUUID());
        own.setSlug("huong-dan-xet-nghiem");
        Article other = new Article();
        other.setId(UUID.randomUUID());
        other.setSlug("Huong-Dan-Xet-Nghiem");

        when(repository.findBySlug("huong-dan-xet-nghiem")).thenReturn(Optional.of(own));
        when(repository.findBySlug("huong-dan-xet-nghiem-2")).thenReturn(Optional.empty());
        when(repository.existsBySlugIgnoreCaseAndSlugNotAndIdNot(
            "huong-dan-xet-nghiem-2", "huong-dan-xet-nghiem-2", own.getId())).thenReturn(true);

        AdminArticleService service = new AdminArticleService(repository);
        assertThatThrownBy(() -> service.update("huong-dan-xet-nghiem", new ArticleRequest(
            "Hướng dẫn", "huong-dan-xet-nghiem-2", "Tóm tắt", "Nội dung", false)))
            .isInstanceOf(DuplicateResourceException.class)
            .satisfies(thrown -> assertThat(((BusinessException) thrown).getStatus()).isEqualTo(409));

        verify(repository, never()).saveAndFlush(any(Article.class));
    }

    @Test
    void legacyMixedCaseRowStaysEditableInPlaceDespiteCaselessSiblings() {
        ArticleRepository repository = mock(ArticleRepository.class);
        Article legacyUpper = new Article();
        legacyUpper.setId(UUID.randomUUID());
        legacyUpper.setSlug("Tang-Huyet");
        Article legacyLower = new Article();
        legacyLower.setId(UUID.randomUUID());
        legacyLower.setSlug("tang-huyet");

        // Two legacy rows already share one lower-cased slug. Editing the upper
        // row without renaming it must not be held hostage by that history:
        // only NEW writes (creates, renames) are constrained.
        when(repository.findBySlug("Tang-Huyet")).thenReturn(Optional.of(legacyUpper));
        when(repository.findBySlug("tang-huyet")).thenReturn(Optional.of(legacyLower));
        when(repository.saveAndFlush(any(Article.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        AdminArticleService service = new AdminArticleService(repository);
        Article edited = service.update("Tang-Huyet", new ArticleRequest(
            "Tụt huyết áp (sửa)", "Tang-Huyet", "Tóm tắt mới", "Nội dung mới", false));

        assertThat(edited.getTitle()).isEqualTo("Tụt huyết áp (sửa)");
    }

    // ── T1 (service level): what actually reaches storage ───────────────────

    @Test
    void nestedTagsCannotReassembleIntoTheStoredBody() {
        Fixture fixture = fixture();
        String slug = "nested-sanitize-fixture-" + System.nanoTime();

        fixture.service().create(new ArticleRequest(
            "Tiêu đề", slug, "Tóm tắt", "<scr<iframe>ipt>alert(1)</scr<iframe>ipt>", true));

        String stored = fixture.records().get(slug).getBody();
        assertThat(stored).doesNotContain("<script");
        assertThat(stored).doesNotContain("alert(1)");
    }
}
