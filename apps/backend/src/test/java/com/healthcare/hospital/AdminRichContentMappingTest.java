package com.healthcare.hospital;

import com.healthcare.hospital.dto.ArticleRequest;
import com.healthcare.hospital.dto.ArticleSectionRequest;
import com.healthcare.hospital.dto.SpecialtyRequest;
import com.healthcare.hospital.entity.Article;
import com.healthcare.hospital.entity.Specialty;
import com.healthcare.hospital.repository.ArticleRepository;
import com.healthcare.hospital.repository.SpecialtyRepository;
import com.healthcare.hospital.service.AdminArticleService;
import com.healthcare.hospital.service.AdminSpecialtyService;
import org.junit.jupiter.api.Test;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminRichContentMappingTest {

    @Test
    void mapsSpecialtyHealthQuestionFieldsToCanonicalJsonArrays() {
        SpecialtyRepository repository = mock(SpecialtyRepository.class);
        when(repository.findBySlug(any())).thenReturn(Optional.empty());
        when(repository.saveAndFlush(any(Specialty.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        Specialty saved = new AdminSpecialtyService(repository).create(new SpecialtyRequest(
            "Nội tổng quát",
            "noi-tong-quat",
            "Tư vấn sức khỏe thường gặp",
            List.of("Sốt", "Mệt mỏi"),
            List.of("Mang danh sách thuốc"),
            "Đặt lịch khám khi triệu chứng kéo dài.",
            true
        ));

        assertThat(saved.getCommonSymptoms().get(0).asText()).isEqualTo("Sốt");
        assertThat(saved.getCommonSymptoms().get(1).asText()).isEqualTo("Mệt mỏi");
        assertThat(saved.getPreparationSteps().get(0).asText()).isEqualTo("Mang danh sách thuốc");
        assertThat(saved.getCarePathway()).isEqualTo("Đặt lịch khám khi triệu chứng kéo dài.");
    }

    @Test
    void mapsClinicalArticleAndSpecialtyVocabularyToTypedJsonFields() {
        SpecialtyRepository specialtyRepository = mock(SpecialtyRepository.class);
        when(specialtyRepository.findBySlug(any())).thenReturn(Optional.empty());
        when(specialtyRepository.saveAndFlush(any(Specialty.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
        Specialty specialty = new AdminSpecialtyService(specialtyRepository).create(new SpecialtyRequest(
            "Tim mạch", "tim-mach", "Mô tả", List.of("Đau ngực"), List.of("Mang thuốc"), "Theo dõi",
            "Tổng quan", List.of("Tăng huyết áp"), List.of("Khó thở"), List.of("Vận động"),
            "Khi có dấu hiệu nặng", List.of("WHO"), Map.of("review", "2026"), true));
        assertThat(specialty.getClinicalOverview()).isEqualTo("Tổng quan");
        assertThat(specialty.getCommonConditions().get(0).asText()).isEqualTo("Tăng huyết áp");
        assertThat(specialty.getRedFlags().get(0).asText()).isEqualTo("Khó thở");
        assertThat(specialty.getClinicalMetadata().get("review").asText()).isEqualTo("2026");

        ArticleRepository articleRepository = mock(ArticleRepository.class);
        when(articleRepository.findBySlug(any())).thenReturn(Optional.empty());
        when(articleRepository.saveAndFlush(any(Article.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));
        Article article = new AdminArticleService(articleRepository).create(new ArticleRequest(
            "Bài", "bai", "Tóm tắt", "Nội dung", "Sức khỏe", "BS A", 4, "tim-mach",
            null, null, null, null, null, null, null, List.<ArticleSectionRequest>of(),
            "vi", "PATIENT", List.of("tim"), List.of("Uống thuốc"), List.of("Đau ngực"),
            List.of("Tập thể dục"), "Khi khó thở", List.of("WHO"), Map.of("grade", "A"),
            "Không thay thế tư vấn", true, true));
        assertThat(article.getTopicTags().get(0).asText()).isEqualTo("tim");
        assertThat(article.getWarningSigns().get(0).asText()).isEqualTo("Đau ngực");
        assertThat(article.getClinicalMetadata().get("grade").asText()).isEqualTo("A");
        assertThat(article.isFeatured()).isTrue();
    }

    @Test
    void mapsArticleEditorialMetadataAndSectionsWithoutAcceptingRawJson() {
        ArticleRepository repository = mock(ArticleRepository.class);
        when(repository.findBySlug(any())).thenReturn(Optional.empty());
        when(repository.saveAndFlush(any(Article.class)))
            .thenAnswer(invocation -> invocation.getArgument(0));

        Article saved = new AdminArticleService(repository).create(new ArticleRequest(
            "Nhận biết dấu hiệu cần đi khám",
            "dau-hieu-can-di-kham",
            "Hướng dẫn sức khỏe đã biên tập",
            "Nội dung tổng quan.",
            "Bệnh thường gặp",
            "Ban biên tập bệnh viện",
            5,
            "noi-tong-quat",
            List.of(new ArticleSectionRequest("Khi nào cần khám?", "Nếu triệu chứng kéo dài.")),
            true
        ));

        assertThat(saved.getCategory()).isEqualTo("Bệnh thường gặp");
        assertThat(saved.getAuthorName()).isEqualTo("Ban biên tập bệnh viện");
        assertThat(saved.getReadingMinutes()).isEqualTo(5);
        assertThat(saved.getRelatedSpecialtySlug()).isEqualTo("noi-tong-quat");
        assertThat(saved.getSections().get(0).get("heading").asText())
            .isEqualTo("Khi nào cần khám?");
        assertThat(saved.getSections().get(0).get("body").asText())
            .isEqualTo("Nếu triệu chứng kéo dài.");
    }

    @Test
    void richAdminUpdateCanExplicitlyClearScheduledPublication() {
        ArticleRepository repository = mock(ArticleRepository.class);
        Article existing = new Article();
        existing.setTitle("Bài cũ");
        existing.setSlug("bai-cu");
        existing.setSummary("Tóm tắt");
        existing.setBody("Nội dung");
        existing.setActive(true);
        existing.setScheduledPublishAt(OffsetDateTime.now().plusDays(2));
        when(repository.findBySlug("bai-cu")).thenReturn(Optional.of(existing));
        when(repository.findBySlug("bai-moi")).thenReturn(Optional.empty());
        when(repository.saveAndFlush(any(Article.class))).thenAnswer(invocation -> invocation.getArgument(0));

        Article updated = new AdminArticleService(repository).update(
            "bai-cu", new ArticleRequest("Bài mới", "bai-moi", "Tóm tắt mới", "Nội dung mới", true));

        assertThat(updated.getScheduledPublishAt()).isNull();
    }
}
